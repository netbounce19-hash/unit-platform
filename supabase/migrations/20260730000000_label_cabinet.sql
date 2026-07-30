-- ============================================================================
-- 0002_label_cabinet — кабинет лейбла и связка с артистами.
--
-- ВАЖНО ОБ ЭТОЙ МИГРАЦИИ:
-- Таблицы releases, budget_requests, assets, profiles уже существуют
-- (миграции 20260725…–20260729…) и на них работает артистский кабинет.
-- Поэтому они НЕ пересоздаются: колонки добавляются как nullable,
-- CHECK-ограничения расширяются так, чтобы старые значения остались
-- валидными. Политики из ранних миграций пересозданы ниже целиком.
--
-- Идемпотентна: безопасно применять повторно.
-- ============================================================================

-- ── 1. Организации и участники ──────────────────────────────────────────────

create table if not exists public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('label_admin', 'label_manager')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index if not exists memberships_org_idx  on public.memberships (org_id);
create index if not exists memberships_user_idx on public.memberships (user_id);

-- ── 2. Артисты лейбла ───────────────────────────────────────────────────────

create table if not exists public.artists (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  -- пока артист не принял приглашение, user_id пуст
  user_id    uuid references auth.users (id) on delete set null,
  stage_name text not null,
  terms      jsonb not null default '{}'::jsonb,  -- {royalty_pct, term_months, exclusive}
  status     text not null default 'invited',
  created_at timestamptz not null default now()
);

create index if not exists artists_org_idx  on public.artists (org_id);
create index if not exists artists_user_idx on public.artists (user_id);

create table if not exists public.artist_invites (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  artist_id   uuid references public.artists (id) on delete cascade,
  email       text not null,
  token       text not null unique,
  expires_at  timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists artist_invites_org_idx   on public.artist_invites (org_id);
create index if not exists artist_invites_email_idx on public.artist_invites (lower(email));

-- ── 3. Достройка существующих таблиц ────────────────────────────────────────

-- releases: добавляем связку с лейблом и поля утверждения.
alter table public.releases
  add column if not exists org_id       uuid references public.organizations (id) on delete cascade,
  add column if not exists artist_id    uuid references public.artists (id) on delete cascade,
  add column if not exists strategy     text,
  add column if not exists planned_date date,
  add column if not exists approved_by  uuid references auth.users (id),
  add column if not exists approved_at  timestamptz;

-- Статусы: новый словарь + legacy-значения, которыми пишет артистский кабинет
-- ('upcoming' при создании релиза, 'live' у вышедших).
alter table public.releases drop constraint if exists releases_status_check;
alter table public.releases add constraint releases_status_check check (
  status in (
    'draft', 'pending_approval', 'approved', 'in_progress', 'released', 'rejected',
    'upcoming', 'live'   -- legacy, см. заметку в конце файла
  )
);

create index if not exists releases_org_idx    on public.releases (org_id);
create index if not exists releases_artist_idx on public.releases (artist_id);

-- budget_requests: у существующей таблицы purpose NOT NULL — оставляем как есть,
-- новые поля добавляем nullable.
alter table public.budget_requests
  add column if not exists org_id           uuid references public.organizations (id) on delete cascade,
  add column if not exists artist_id        uuid references public.artists (id) on delete cascade,
  add column if not exists category         text,
  add column if not exists comment          text,
  add column if not exists decided_by       uuid references auth.users (id),
  add column if not exists decided_at       timestamptz,
  add column if not exists decision_comment text;

-- 'declined' — legacy-значение артистского кабинета, 'rejected' — из новой модели.
alter table public.budget_requests drop constraint if exists budget_requests_status_check;
alter table public.budget_requests add constraint budget_requests_status_check check (
  status in ('pending', 'approved', 'rejected', 'declined')
);

create index if not exists budget_requests_org_idx    on public.budget_requests (org_id);
create index if not exists budget_requests_artist_idx on public.budget_requests (artist_id);

-- assets: привязка загрузок к лейблу и артисту.
alter table public.assets
  add column if not exists org_id    uuid references public.organizations (id) on delete cascade,
  add column if not exists artist_id uuid references public.artists (id) on delete cascade;

create index if not exists assets_org_idx    on public.assets (org_id);
create index if not exists assets_artist_idx on public.assets (artist_id);

-- profiles.role уже добавлена миграцией 20260727101913
-- (default 'artist', check in ('artist','label')) — здесь только страхуемся.
alter table public.profiles
  add column if not exists role text not null default 'artist';

-- ── 4. Задачи, промо-отчёты, уведомления ────────────────────────────────────

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  artist_id    uuid not null references public.artists (id) on delete cascade,
  release_id   uuid references public.releases (id) on delete set null,
  title        text not null,
  description  text,
  due_date     date,
  status       text not null default 'todo' check (status in ('todo', 'done')),
  created_by   uuid references auth.users (id),
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists tasks_org_idx    on public.tasks (org_id);
create index if not exists tasks_artist_idx on public.tasks (artist_id);
create index if not exists tasks_due_idx    on public.tasks (org_id, status, due_date);

create table if not exists public.promo_reports (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  artist_id  uuid not null references public.artists (id) on delete cascade,
  release_id uuid references public.releases (id) on delete set null,
  platform   text not null,
  url        text,
  asset_id   uuid references public.assets (id) on delete set null,
  status     text not null default 'submitted'
               check (status in ('submitted', 'accepted', 'needs_changes')),
  created_at timestamptz not null default now()
);

create index if not exists promo_reports_org_idx    on public.promo_reports (org_id);
create index if not exists promo_reports_artist_idx on public.promo_reports (artist_id);

-- Outbox: сюда пишут триггеры, отправку в Telegram добавим позже.
create table if not exists public.notifications (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid references public.organizations (id) on delete cascade,
  recipient_user_id uuid references auth.users (id) on delete cascade,
  event_type        text not null,
  payload           jsonb not null default '{}'::jsonb,
  status            text not null default 'pending'
                      check (status in ('pending', 'sent', 'failed')),
  created_at        timestamptz not null default now()
);

create index if not exists notifications_org_idx       on public.notifications (org_id);
create index if not exists notifications_recipient_idx on public.notifications (recipient_user_id, status);

-- ── 5. Security definer функции (защита от рекурсии RLS) ────────────────────
-- Политики не должны читать таблицы, на которых сами висят, иначе Postgres
-- уходит в рекурсию. Поэтому все проверки принадлежности — через эти функции:
-- они обходят RLS и потому безопасны для использования внутри политик.

create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = auth.uid()
  );
$$;

create or replace function public.my_artist_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select a.id from public.artists a where a.user_id = auth.uid() limit 1;
$$;

create or replace function public.my_org_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select a.org_id from public.artists a where a.user_id = auth.uid() limit 1;
$$;

-- Нужна для storage-политик: доступ к папке {user_id}/… есть у самого владельца
-- и у участника org, в котором этот пользователь числится артистом.
-- Принимает text и сама проверяет, что это валидный uuid: имя объекта
-- в бакете произвольное, прямой ::uuid уронил бы политику.
create or replace function public.can_access_user_folder(p_folder text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case
    when p_folder is null then false
    when p_folder !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then false
    else
      p_folder::uuid = auth.uid()
      or exists (
        select 1
        from public.artists a
        join public.memberships m on m.org_id = a.org_id
        where a.user_id = p_folder::uuid and m.user_id = auth.uid()
      )
  end;
$$;

-- ── 6. RLS ──────────────────────────────────────────────────────────────────

alter table public.organizations  enable row level security;
alter table public.memberships    enable row level security;
alter table public.artists        enable row level security;
alter table public.artist_invites enable row level security;
alter table public.tasks          enable row level security;
alter table public.promo_reports  enable row level security;
alter table public.notifications  enable row level security;

-- organizations -------------------------------------------------------------
drop policy if exists "orgs: member select" on public.organizations;
create policy "orgs: member select" on public.organizations
  for select to authenticated
  using (public.is_org_member(id) or id = public.my_org_id());

drop policy if exists "orgs: member update" on public.organizations;
create policy "orgs: member update" on public.organizations
  for update to authenticated
  using (public.is_org_member(id)) with check (public.is_org_member(id));

-- memberships ---------------------------------------------------------------
drop policy if exists "memberships: member select" on public.memberships;
create policy "memberships: member select" on public.memberships
  for select to authenticated
  using (user_id = auth.uid() or public.is_org_member(org_id));

drop policy if exists "memberships: member manage" on public.memberships;
create policy "memberships: member manage" on public.memberships
  for all to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

-- artists -------------------------------------------------------------------
drop policy if exists "artists: label select" on public.artists;
create policy "artists: label select" on public.artists
  for select to authenticated
  using (public.is_org_member(org_id) or user_id = auth.uid());

drop policy if exists "artists: label insert" on public.artists;
create policy "artists: label insert" on public.artists
  for insert to authenticated with check (public.is_org_member(org_id));

drop policy if exists "artists: label update" on public.artists;
create policy "artists: label update" on public.artists
  for update to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists "artists: label delete" on public.artists;
create policy "artists: label delete" on public.artists
  for delete to authenticated using (public.is_org_member(org_id));

-- artist_invites ------------------------------------------------------------
-- Артист приглашение по токену не читает: погашение идёт через RPC
-- accept_artist_invite() (security definer) — иначе токен пришлось бы
-- открывать на select всем аутентифицированным.
drop policy if exists "invites: label select" on public.artist_invites;
create policy "invites: label select" on public.artist_invites
  for select to authenticated using (public.is_org_member(org_id));

drop policy if exists "invites: label insert" on public.artist_invites;
create policy "invites: label insert" on public.artist_invites
  for insert to authenticated with check (public.is_org_member(org_id));

drop policy if exists "invites: label update" on public.artist_invites;
create policy "invites: label update" on public.artist_invites
  for update to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists "invites: label delete" on public.artist_invites;
create policy "invites: label delete" on public.artist_invites
  for delete to authenticated using (public.is_org_member(org_id));

-- tasks ---------------------------------------------------------------------
drop policy if exists "tasks: select" on public.tasks;
create policy "tasks: select" on public.tasks
  for select to authenticated
  using (public.is_org_member(org_id) or artist_id = public.my_artist_id());

drop policy if exists "tasks: label insert" on public.tasks;
create policy "tasks: label insert" on public.tasks
  for insert to authenticated with check (public.is_org_member(org_id));

-- Артисту разрешаем UPDATE своей задачи; какие поля он может менять
-- (только status/completed_at) — стережёт триггер tasks_guard_columns.
drop policy if exists "tasks: update" on public.tasks;
create policy "tasks: update" on public.tasks
  for update to authenticated
  using (public.is_org_member(org_id) or artist_id = public.my_artist_id())
  with check (public.is_org_member(org_id) or artist_id = public.my_artist_id());

drop policy if exists "tasks: label delete" on public.tasks;
create policy "tasks: label delete" on public.tasks
  for delete to authenticated using (public.is_org_member(org_id));

-- promo_reports -------------------------------------------------------------
drop policy if exists "promo: select" on public.promo_reports;
create policy "promo: select" on public.promo_reports
  for select to authenticated
  using (public.is_org_member(org_id) or artist_id = public.my_artist_id());

drop policy if exists "promo: insert" on public.promo_reports;
create policy "promo: insert" on public.promo_reports
  for insert to authenticated
  with check (public.is_org_member(org_id) or artist_id = public.my_artist_id());

drop policy if exists "promo: update" on public.promo_reports;
create policy "promo: update" on public.promo_reports
  for update to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));

drop policy if exists "promo: label delete" on public.promo_reports;
create policy "promo: label delete" on public.promo_reports
  for delete to authenticated using (public.is_org_member(org_id));

-- notifications -------------------------------------------------------------
drop policy if exists "notifications: recipient select" on public.notifications;
create policy "notifications: recipient select" on public.notifications
  for select to authenticated
  using (recipient_user_id = auth.uid() or public.is_org_member(org_id));

drop policy if exists "notifications: recipient update" on public.notifications;
create policy "notifications: recipient update" on public.notifications
  for update to authenticated
  using (recipient_user_id = auth.uid()) with check (recipient_user_id = auth.uid());

-- ── 7. Пересозданные политики из ранних миграций ────────────────────────────
-- Логика прежняя (владелец видит своё) + доступ участников org к данным
-- своих артистов. Артистский кабинет продолжает работать по owner_id.

-- profiles ------------------------------------------------------------------
drop policy if exists "profiles: owner can select" on public.profiles;
drop policy if exists "profiles: owner can update" on public.profiles;

create policy "profiles: select own or org artist" on public.profiles
  for select to authenticated
  using (
    auth.uid() = id
    or exists (
      select 1 from public.artists a
      where a.user_id = public.profiles.id and public.is_org_member(a.org_id)
    )
  );

create policy "profiles: owner update" on public.profiles
  for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- assets --------------------------------------------------------------------
drop policy if exists "assets: owner can select" on public.assets;
drop policy if exists "assets: owner can insert" on public.assets;
drop policy if exists "assets: owner can update" on public.assets;
drop policy if exists "assets: owner can delete" on public.assets;

create policy "assets: select own or org" on public.assets
  for select to authenticated
  using (
    auth.uid() = owner_id
    or (org_id is not null and public.is_org_member(org_id))
    or exists (
      select 1 from public.artists a
      where a.user_id = public.assets.owner_id and public.is_org_member(a.org_id)
    )
  );

create policy "assets: owner insert" on public.assets
  for insert to authenticated with check (auth.uid() = owner_id);

create policy "assets: update own or org" on public.assets
  for update to authenticated
  using (auth.uid() = owner_id or (org_id is not null and public.is_org_member(org_id)))
  with check (auth.uid() = owner_id or (org_id is not null and public.is_org_member(org_id)));

create policy "assets: owner delete" on public.assets
  for delete to authenticated using (auth.uid() = owner_id);

-- releases ------------------------------------------------------------------
drop policy if exists "releases: owner select" on public.releases;
drop policy if exists "releases: owner insert" on public.releases;
drop policy if exists "releases: owner update" on public.releases;
drop policy if exists "releases: owner delete" on public.releases;

create policy "releases: select own or org" on public.releases
  for select to authenticated
  using (
    auth.uid() = owner_id
    or (org_id is not null and public.is_org_member(org_id))
    or (artist_id is not null and artist_id = public.my_artist_id())
  );

create policy "releases: insert own or org" on public.releases
  for insert to authenticated
  with check (
    auth.uid() = owner_id
    or (org_id is not null and public.is_org_member(org_id))
  );

create policy "releases: update own or org" on public.releases
  for update to authenticated
  using (auth.uid() = owner_id or (org_id is not null and public.is_org_member(org_id)))
  with check (auth.uid() = owner_id or (org_id is not null and public.is_org_member(org_id)));

create policy "releases: delete own or org" on public.releases
  for delete to authenticated
  using (auth.uid() = owner_id or (org_id is not null and public.is_org_member(org_id)));

-- budget_requests -----------------------------------------------------------
drop policy if exists "budget: owner select" on public.budget_requests;
drop policy if exists "budget: owner insert" on public.budget_requests;
drop policy if exists "budget: owner update" on public.budget_requests;
drop policy if exists "budget: owner delete" on public.budget_requests;

create policy "budget: select own or org" on public.budget_requests
  for select to authenticated
  using (
    auth.uid() = owner_id
    or (org_id is not null and public.is_org_member(org_id))
    or (artist_id is not null and artist_id = public.my_artist_id())
  );

create policy "budget: insert own" on public.budget_requests
  for insert to authenticated
  with check (
    auth.uid() = owner_id
    or (artist_id is not null and artist_id = public.my_artist_id())
  );

-- Лейбл меняет только поля решения — стережёт триггер budget_guard_columns.
create policy "budget: update own or org" on public.budget_requests
  for update to authenticated
  using (auth.uid() = owner_id or (org_id is not null and public.is_org_member(org_id)))
  with check (auth.uid() = owner_id or (org_id is not null and public.is_org_member(org_id)));

create policy "budget: owner delete" on public.budget_requests
  for delete to authenticated using (auth.uid() = owner_id);

-- ── 8. storage.objects для бакета artist-files ──────────────────────────────
-- Путь прежний: {user_id}/{kind}/{file}. Доступ — владелец либо участник org,
-- в котором этот пользователь числится артистом.

drop policy if exists "artist-files: owner can select" on storage.objects;
drop policy if exists "artist-files: owner can insert" on storage.objects;
drop policy if exists "artist-files: owner can update" on storage.objects;
drop policy if exists "artist-files: owner can delete" on storage.objects;

create policy "artist-files: select owner or org" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'artist-files'
    and public.can_access_user_folder((storage.foldername(name))[1])
  );

-- Заливать по-прежнему может только сам владелец папки.
create policy "artist-files: insert owner" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'artist-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "artist-files: update owner" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'artist-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'artist-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "artist-files: delete owner" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'artist-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 9. Триггеры ─────────────────────────────────────────────────────────────

-- 9.1 Артист привязан к аккаунту → отмечаем роль в профиле.
create or replace function public.artists_sync_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    update public.profiles set role = 'artist' where id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists artists_sync_profile_role on public.artists;
create trigger artists_sync_profile_role
  after insert or update of user_id on public.artists
  for each row execute function public.artists_sync_profile_role();

-- 9.2 Принятие приглашения: гасим токен и связываем артиста с аккаунтом.
create or replace function public.artist_invites_on_accept()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.accepted_at is not null and old.accepted_at is null then
    if new.artist_id is not null then
      update public.artists
        set user_id = coalesce(user_id, auth.uid()),
            status  = 'active'
        where id = new.artist_id;
    else
      insert into public.artists (org_id, user_id, stage_name, status)
      values (new.org_id, auth.uid(), split_part(new.email, '@', 1), 'active');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists artist_invites_on_accept on public.artist_invites;
create trigger artist_invites_on_accept
  after update of accepted_at on public.artist_invites
  for each row execute function public.artist_invites_on_accept();

-- Артист гасит приглашение только через эту функцию: строку инвайта
-- он не видит (нет select-политики), а токен проверяется здесь.
create or replace function public.accept_artist_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.artist_invites;
begin
  select * into v_invite from public.artist_invites
   where token = p_token
   for update;

  if not found then
    raise exception 'Приглашение не найдено';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'Приглашение уже использовано';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'Срок приглашения истёк';
  end if;

  update public.artist_invites
     set accepted_at = now()
   where id = v_invite.id;  -- триггер выше свяжет артиста

  return v_invite.org_id;
end;
$$;

-- 9.3 Ограничение полей при UPDATE (RLS не умеет колоночные правила).
create or replace function public.tasks_guard_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Участник лейбла правит задачу как угодно.
  if public.is_org_member(new.org_id) then
    return new;
  end if;

  -- Артисту оставляем только закрытие/переоткрытие своей задачи.
  if new.artist_id is distinct from old.artist_id
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.due_date is distinct from old.due_date
     or new.release_id is distinct from old.release_id
     or new.org_id is distinct from old.org_id then
    raise exception 'Артист может менять только статус задачи';
  end if;

  new.completed_at := case when new.status = 'done' then coalesce(new.completed_at, now()) end;
  return new;
end;
$$;

drop trigger if exists tasks_guard_columns on public.tasks;
create trigger tasks_guard_columns
  before update on public.tasks
  for each row execute function public.tasks_guard_columns();

create or replace function public.budget_guard_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;

drop trigger if exists budget_guard_columns on public.budget_requests;
create trigger budget_guard_columns
  before update on public.budget_requests
  for each row execute function public.budget_guard_columns();

-- 9.4 Outbox-уведомления.
create or replace function public.notify_task_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_artist_user uuid;
begin
  select user_id into v_artist_user from public.artists where id = new.artist_id;

  if tg_op = 'INSERT' then
    if v_artist_user is not null then
      insert into public.notifications (org_id, recipient_user_id, event_type, payload)
      values (new.org_id, v_artist_user, 'task.assigned',
              jsonb_build_object('task_id', new.id, 'title', new.title, 'due_date', new.due_date));
    end if;

  elsif new.status is distinct from old.status then
    if new.status = 'done' and new.created_by is not null then
      insert into public.notifications (org_id, recipient_user_id, event_type, payload)
      values (new.org_id, new.created_by, 'task.completed',
              jsonb_build_object('task_id', new.id, 'title', new.title));
    elsif new.status = 'todo' and v_artist_user is not null then
      insert into public.notifications (org_id, recipient_user_id, event_type, payload)
      values (new.org_id, v_artist_user, 'task.reopened',
              jsonb_build_object('task_id', new.id, 'title', new.title));
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists notify_task_change on public.tasks;
create trigger notify_task_change
  after insert or update on public.tasks
  for each row execute function public.notify_task_change();

create or replace function public.notify_budget_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_artist_user uuid;
begin
  if new.org_id is null then
    return new;  -- заявка старого формата, вне лейбла
  end if;

  if tg_op = 'INSERT' then
    -- Новая заявка — всем участникам лейбла, по строке на получателя.
    insert into public.notifications (org_id, recipient_user_id, event_type, payload)
    select new.org_id, m.user_id, 'budget.submitted',
           jsonb_build_object('request_id', new.id, 'amount', new.amount,
                              'category', coalesce(new.category, new.purpose))
      from public.memberships m
     where m.org_id = new.org_id;

  elsif new.status is distinct from old.status then
    select user_id into v_artist_user from public.artists where id = new.artist_id;
    if v_artist_user is not null then
      insert into public.notifications (org_id, recipient_user_id, event_type, payload)
      values (new.org_id, v_artist_user, 'budget.decided',
              jsonb_build_object('request_id', new.id, 'status', new.status,
                                 'decision_comment', new.decision_comment));
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists notify_budget_change on public.budget_requests;
create trigger notify_budget_change
  after insert or update on public.budget_requests
  for each row execute function public.notify_budget_change();

-- ============================================================================
-- ЗАМЕТКА ПРО LEGACY-СТАТУСЫ
--
-- releases.status временно допускает 'upcoming'/'live', а budget_requests.status
-- — 'declined': ими пишет действующий артистский кабинет
-- (lib/supabase/cabinet.ts). Когда фронтенд переведём на новый словарь
-- ('draft' вместо 'upcoming', 'released' вместо 'live', 'rejected' вместо
-- 'declined'), нужна отдельная миграция: сначала update данных, затем сужение
-- CHECK. Делать это раньше нельзя — иначе артистский кабинет начнёт падать
-- на вставке.
-- ============================================================================
