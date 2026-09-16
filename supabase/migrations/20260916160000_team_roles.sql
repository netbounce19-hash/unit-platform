-- Роли в команде лейбла.
--
-- Было две роли, и обе могли всё — включая управление составом: любой
-- сотрудник мог добавить в лейбл чужой аккаунт или назначить себя
-- администратором, а также переименовать организацию. Теперь:
--
--   label_admin   — всё, включая команду и настройки лейбла
--   label_manager — всё, кроме команды
--   project       — проджект: ростер, задачи, чаты, заявки, решение по релизам,
--                   промо, приглашения, скаутинг
--   scout         — скаутинг, приглашения
--   delivery      — отгрузка: модерация, выпуск релизов, загрузка данных
--   marketing     — промо, чаты, загрузка данных
--   finance       — роялти, авансы, заявки на бюджет, загрузка данных
--
-- Ростер, статистику, задачи, сообщения и промо читают все сотрудники —
-- ограничения стоят на том, что меняет деньги, статусы и состав.

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.memberships'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) like '%role%'
  loop
    execute format('alter table public.memberships drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.memberships
  add constraint memberships_role_check
  check (role in ('label_admin', 'label_manager', 'project', 'scout', 'delivery', 'marketing', 'finance'));

create or replace function public.has_org_role(p_org uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.memberships m
     where m.org_id = p_org and m.user_id = auth.uid() and m.role = any (p_roles)
  );
$function$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.has_org_role(p_org, array['label_admin']);
$function$;

-- ── Состав команды ─────────────────────────────────────────────────────────

drop policy if exists "memberships: member manage" on public.memberships;

create policy "memberships: admin insert"
  on public.memberships for insert
  with check (public.is_org_admin(org_id));

create policy "memberships: admin update"
  on public.memberships for update
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

-- Администратор убирает любого, сотрудник может уйти сам
create policy "memberships: admin or self delete"
  on public.memberships for delete
  using (public.is_org_admin(org_id) or user_id = auth.uid());

-- Лейбл не должен остаться без администратора
create or replace function public.memberships_keep_admin()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- служебные операции (удаление аккаунта, организации) не блокируем
  if auth.uid() is null or not exists (select 1 from public.organizations where id = old.org_id) then
    return coalesce(new, old);
  end if;
  if old.role = 'label_admin'
     and (tg_op = 'DELETE' or new.role <> 'label_admin')
     and not exists (
       select 1 from public.memberships
        where org_id = old.org_id and role = 'label_admin' and id <> old.id
     ) then
    raise exception 'В лейбле должен остаться хотя бы один администратор';
  end if;
  return coalesce(new, old);
end;
$function$;

create trigger memberships_keep_admin
  before update or delete on public.memberships
  for each row execute function public.memberships_keep_admin();

drop policy if exists "orgs: member update" on public.organizations;
create policy "orgs: admin update"
  on public.organizations for update
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

-- Ответственный проджект у артиста
alter table public.artists
  add column manager_id uuid references auth.users (id) on delete set null;

-- Команда лейбла с именами — только для своих
create or replace function public.org_team(p_org uuid)
returns table (user_id uuid, email text, full_name text, role text, joined_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select m.user_id, u.email::text, p.full_name, m.role, m.created_at
    from public.memberships m
    join auth.users u on u.id = m.user_id
    left join public.profiles p on p.id = m.user_id
   where m.org_id = p_org and public.is_org_member(p_org)
   order by m.created_at;
$function$;

-- ── Приглашения в команду ──────────────────────────────────────────────────

create table public.team_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 200),
  role text not null
    check (role in ('label_admin', 'label_manager', 'project', 'scout', 'delivery', 'marketing', 'finance')),
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  invited_by uuid default auth.uid() references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index team_invites_org_idx on public.team_invites (org_id, created_at desc);

alter table public.team_invites enable row level security;

create policy "team invites: admin select"
  on public.team_invites for select
  using (public.is_org_admin(org_id));

create policy "team invites: admin insert"
  on public.team_invites for insert
  with check (public.is_org_admin(org_id));

create policy "team invites: admin delete"
  on public.team_invites for delete
  using (public.is_org_admin(org_id));

-- Для страницы приглашения до входа: только лейбл и роль
create or replace function public.team_invite_info(p_token text)
returns table (org_name text, role text, expired boolean, accepted boolean)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select o.name, t.role, t.expires_at < now(), t.accepted_at is not null
    from public.team_invites t
    join public.organizations o on o.id = t.org_id
   where t.token = p_token;
$function$;

create or replace function public.accept_team_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_inv public.team_invites;
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    raise exception 'Нужно войти в аккаунт';
  end if;

  select * into v_inv from public.team_invites where token = p_token for update;
  if not found then
    raise exception 'Приглашение не найдено';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'Приглашение уже использовано';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'Срок приглашения истёк — попросите новое';
  end if;

  select email into v_email from auth.users where id = v_uid;
  if lower(v_email) <> lower(v_inv.email) then
    raise exception 'Приглашение выписано на другую почту — войдите под адресом, на который оно пришло';
  end if;
  if exists (select 1 from public.artists where user_id = v_uid) then
    raise exception 'Это аккаунт артиста — для работы в лейбле нужен отдельный аккаунт';
  end if;
  if exists (select 1 from public.memberships where user_id = v_uid and org_id <> v_inv.org_id) then
    raise exception 'Аккаунт уже состоит в другом лейбле';
  end if;

  insert into public.memberships (org_id, user_id, role)
  values (v_inv.org_id, v_uid, v_inv.role)
  on conflict (org_id, user_id) do update set role = excluded.role;

  update public.team_invites set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  return v_inv.org_id;
end;
$function$;

revoke all on function public.accept_team_invite(text) from public, anon;
grant execute on function public.accept_team_invite(text) to authenticated;
revoke all on function public.team_invite_info(text) from public;
grant execute on function public.team_invite_info(text) to anon, authenticated;
revoke all on function public.org_team(uuid) from public, anon;
grant execute on function public.org_team(uuid) to authenticated;

-- ── Разделы по ролям ───────────────────────────────────────────────────────

-- Роялти и авансы: администратор, менеджер, финансы
drop policy if exists "royalty statements: select org or own published" on public.royalty_statements;
drop policy if exists "royalty statements: insert org" on public.royalty_statements;
drop policy if exists "royalty statements: update org" on public.royalty_statements;
drop policy if exists "royalty statements: delete org draft" on public.royalty_statements;

create policy "royalty statements: select finance or own published"
  on public.royalty_statements for select
  using (
    public.has_org_role(org_id, array['label_admin', 'label_manager', 'finance'])
    or (artist_id = public.my_artist_id() and status <> 'draft')
  );
create policy "royalty statements: insert finance"
  on public.royalty_statements for insert
  with check (public.has_org_role(org_id, array['label_admin', 'label_manager', 'finance']));
create policy "royalty statements: update finance"
  on public.royalty_statements for update
  using (public.has_org_role(org_id, array['label_admin', 'label_manager', 'finance']))
  with check (public.has_org_role(org_id, array['label_admin', 'label_manager', 'finance']));
create policy "royalty statements: delete finance draft"
  on public.royalty_statements for delete
  using (public.has_org_role(org_id, array['label_admin', 'label_manager', 'finance']) and status = 'draft');

drop policy if exists "royalty lines: select via statement" on public.royalty_lines;
drop policy if exists "royalty lines: write org" on public.royalty_lines;

create policy "royalty lines: select via statement"
  on public.royalty_lines for select
  using (exists (
    select 1 from public.royalty_statements s
     where s.id = statement_id
       and (public.has_org_role(s.org_id, array['label_admin', 'label_manager', 'finance'])
            or (s.artist_id = public.my_artist_id() and s.status <> 'draft'))
  ));
create policy "royalty lines: write finance"
  on public.royalty_lines for all
  using (exists (select 1 from public.royalty_statements s
                  where s.id = statement_id
                    and public.has_org_role(s.org_id, array['label_admin', 'label_manager', 'finance'])))
  with check (exists (select 1 from public.royalty_statements s
                       where s.id = statement_id
                         and public.has_org_role(s.org_id, array['label_admin', 'label_manager', 'finance'])));

drop policy if exists "advances: select org or own" on public.artist_advances;
drop policy if exists "advances: write org" on public.artist_advances;

create policy "advances: select finance or own"
  on public.artist_advances for select
  using (public.has_org_role(org_id, array['label_admin', 'label_manager', 'finance']) or artist_id = public.my_artist_id());
create policy "advances: write finance"
  on public.artist_advances for all
  using (public.has_org_role(org_id, array['label_admin', 'label_manager', 'finance']))
  with check (public.has_org_role(org_id, array['label_admin', 'label_manager', 'finance']));

-- Скаутинг: администратор, менеджер, скаут, проджект
drop policy if exists "demos: org select" on public.demo_submissions;
drop policy if exists "demos: org insert scout finds" on public.demo_submissions;
drop policy if exists "demos: org update" on public.demo_submissions;
drop policy if exists "demos: org delete" on public.demo_submissions;

create policy "demos: scouting select"
  on public.demo_submissions for select
  using (public.has_org_role(org_id, array['label_admin', 'label_manager', 'scout', 'project']));
create policy "demos: scouting insert finds"
  on public.demo_submissions for insert
  with check (public.has_org_role(org_id, array['label_admin', 'label_manager', 'scout', 'project']) and source = 'scout');
create policy "demos: scouting update"
  on public.demo_submissions for update
  using (public.has_org_role(org_id, array['label_admin', 'label_manager', 'scout', 'project']))
  with check (public.has_org_role(org_id, array['label_admin', 'label_manager', 'scout', 'project']));
create policy "demos: scouting delete"
  on public.demo_submissions for delete
  using (public.has_org_role(org_id, array['label_admin', 'label_manager', 'scout', 'project']));

-- Приглашения артистов: администратор, менеджер, проджект, скаут
drop policy if exists "invites: label select" on public.artist_invites;
drop policy if exists "invites: label insert" on public.artist_invites;
drop policy if exists "invites: label update" on public.artist_invites;
drop policy if exists "invites: label delete" on public.artist_invites;

create policy "invites: select" on public.artist_invites for select
  using (public.has_org_role(org_id, array['label_admin', 'label_manager', 'project', 'scout']));
create policy "invites: insert" on public.artist_invites for insert
  with check (public.has_org_role(org_id, array['label_admin', 'label_manager', 'project', 'scout']));
create policy "invites: update" on public.artist_invites for update
  using (public.has_org_role(org_id, array['label_admin', 'label_manager', 'project', 'scout']))
  with check (public.has_org_role(org_id, array['label_admin', 'label_manager', 'project', 'scout']));
create policy "invites: delete" on public.artist_invites for delete
  using (public.has_org_role(org_id, array['label_admin', 'label_manager', 'project', 'scout']));

-- Загрузка стримов: администратор, менеджер, отгрузка, маркетинг, финансы
drop policy if exists "stream periods: write org" on public.artist_stream_periods;
create policy "stream periods: write data roles"
  on public.artist_stream_periods for all
  using (public.has_org_role(org_id, array['label_admin', 'label_manager', 'delivery', 'marketing', 'finance']))
  with check (public.has_org_role(org_id, array['label_admin', 'label_manager', 'delivery', 'marketing', 'finance']));

-- Решения по релизам: приёмка — проджект; модерация и выпуск — отгрузка
create or replace function public.guard_release_decision()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.org_id is not null and public.is_org_member(new.org_id) then
    if tg_op = 'UPDATE' then
      if (new.status is distinct from old.status and new.status in ('approved', 'rejected', 'pending_approval'))
         or new.approved_by is distinct from old.approved_by
         or new.approved_at is distinct from old.approved_at then
        if not public.has_org_role(new.org_id, array['label_admin', 'label_manager', 'project']) then
          raise exception 'Решение по релизу принимает проджект или менеджер';
        end if;
      end if;

      if (new.status is distinct from old.status and new.status in ('in_progress', 'released'))
         or new.moderation_status is distinct from old.moderation_status
         or new.moderation_checks is distinct from old.moderation_checks
         or new.is_explicit is distinct from old.is_explicit
         or new.moderation_comment is distinct from old.moderation_comment then
        if not public.has_org_role(new.org_id, array['label_admin', 'label_manager', 'delivery']) then
          raise exception 'Модерацию и выпуск ведёт отдел отгрузки';
        end if;
      end if;
    end if;

    if new.status in ('in_progress', 'released')
       and new.status is distinct from coalesce(old.status, '')
       and new.moderation_status <> 'passed' then
      raise exception 'Сначала релиз должен пройти модерацию';
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending_approval';
    new.approved_by := null;
    new.approved_at := null;
    new.moderation_status := 'pending';
    new.moderation_checks := '{}'::jsonb;
    new.is_explicit := false;
    new.moderation_comment := null;
    new.moderated_by := null;
    new.moderated_at := null;
    return new;
  end if;

  if new.status is distinct from old.status
     or new.approved_by is distinct from old.approved_by
     or new.approved_at is distinct from old.approved_at then
    raise exception 'Статус приёмки релиза меняет только сотрудник лейбла';
  end if;

  if new.moderation_status is distinct from old.moderation_status
     or new.moderation_checks is distinct from old.moderation_checks
     or new.is_explicit is distinct from old.is_explicit
     or new.moderation_comment is distinct from old.moderation_comment
     or new.moderated_by is distinct from old.moderated_by
     or new.moderated_at is distinct from old.moderated_at then
    raise exception 'Модерацию проводит сотрудник лейбла';
  end if;

  return new;
end;
$function$;

-- Решения по заявкам на бюджет: администратор, менеджер, проджект, финансы
create or replace function public.budget_guard_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if public.is_org_member(new.org_id) then
    -- Лейбл трогает только поля решения.
    if new.amount is distinct from old.amount
       or new.category is distinct from old.category
       or new.purpose is distinct from old.purpose
       or new.comment is distinct from old.comment
       or new.artist_id is distinct from old.artist_id
       or new.org_id is distinct from old.org_id then
      raise exception 'Лейбл может менять только решение по заявке';
    end if;
    if (new.status is distinct from old.status or new.decision_comment is distinct from old.decision_comment)
       and not public.has_org_role(new.org_id, array['label_admin', 'label_manager', 'project', 'finance']) then
      raise exception 'Решение по заявке принимает проджект, финансы или менеджер';
    end if;
    if new.status is distinct from old.status then
      new.decided_by := coalesce(new.decided_by, auth.uid());
      new.decided_at := coalesce(new.decided_at, now());
    end if;
    return new;
  end if;

  -- Артист не подписывает решение сам и правит заявку только пока она ждёт.
  if new.status is distinct from old.status
     or new.decided_by is distinct from old.decided_by
     or new.decided_at is distinct from old.decided_at
     or new.decision_comment is distinct from old.decision_comment then
    raise exception 'Решение по заявке принимает лейбл';
  end if;
  if old.status <> 'pending' then
    raise exception 'Заявка уже рассмотрена';
  end if;

  return new;
end;
$function$;

-- has_org_role и is_org_admin остаются доступны гостю: их вызывают политики,
-- и для гостя они просто возвращают false (auth.uid() пуст)
