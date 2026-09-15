-- Модерация контента и отчёты по роялти.
--
-- Модерация. Из-за требований закона о запрете пропаганды наркотиков
-- лейблы проверяют треки — и новые, и уже выпущенные — и при необходимости
-- заменяют их цензурными версиями. Проверка ручная, поэтому это чек-лист у релиза и решение
-- сотрудника лейбла с датой и автором. Без пройденной модерации релиз
-- нельзя передать в отгрузку или отметить вышедшим.
--
-- Роялти. Лейблы чаще всего теряют артистов и репутацию на выплатах:
-- неправильно посчитали, не заплатили к сроку. Отчёт считается в базе, а не
-- в браузере, чтобы артист и лейбл видели одни и те же цифры. Опубликованный
-- отчёт неизменен по суммам — поправить можно, только вернув в черновик.

-- ── Модерация ──────────────────────────────────────────────────────────────

alter table public.releases
  add column moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'passed', 'needs_changes')),
  -- {"lyrics": true, "drugs": true, "violence": true, "profanity": true}
  add column moderation_checks jsonb not null default '{}'::jsonb,
  add column is_explicit boolean not null default false,
  add column moderation_comment text,
  add column moderated_by uuid references auth.users (id),
  add column moderated_at timestamptz;

-- Цензурная версия трека — обычный аудиофайл релиза с отметкой
alter table public.assets
  add column is_clean_version boolean not null default false;

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
    -- Отгрузка и выход — только после модерации
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

-- ── Роялти ─────────────────────────────────────────────────────────────────

create table public.royalty_statements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  share_pct numeric(5, 2) not null check (share_pct between 0 and 100),
  deductions numeric(14, 2) not null default 0 check (deductions >= 0),
  -- считаются функцией recalc_royalty_statement
  gross numeric(14, 2) not null default 0,
  royalty numeric(14, 2) not null default 0,
  recouped numeric(14, 2) not null default 0,
  payout numeric(14, 2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'paid')),
  due_date date,
  note text,
  published_at timestamptz,
  paid_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (artist_id, period_start, period_end)
);

create index royalty_statements_org_idx on public.royalty_statements (org_id, status, due_date);

create table public.royalty_lines (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.royalty_statements (id) on delete cascade,
  source text not null,
  streams bigint not null default 0 check (streams >= 0),
  revenue numeric(14, 2) not null default 0 check (revenue >= 0),
  created_at timestamptz not null default now()
);

create index royalty_lines_statement_idx on public.royalty_lines (statement_id);

create table public.artist_advances (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  artist_id uuid not null references public.artists (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  paid_on date not null default current_date,
  note text,
  created_by uuid default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create index artist_advances_artist_idx on public.artist_advances (artist_id);

-- Артист должен быть из того же лейбла, что и отчёт / аванс
create or replace function public.royalty_check_artist_org()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (select 1 from public.artists a where a.id = new.artist_id and a.org_id = new.org_id) then
    raise exception 'Артист не состоит в этом лейбле';
  end if;
  return new;
end;
$function$;

create trigger royalty_statements_artist_org
  before insert or update of artist_id, org_id on public.royalty_statements
  for each row execute function public.royalty_check_artist_org();

create trigger artist_advances_artist_org
  before insert or update of artist_id, org_id on public.artist_advances
  for each row execute function public.royalty_check_artist_org();

-- Пересчёт сумм отчёта.
--   gross    = сумма доходов по строкам
--   royalty  = gross × доля артиста
--   recouped = сколько аванса гасится этим отчётом: не больше остатка аванса
--              (выдано минус погашено другими опубликованными отчётами)
--              и не больше royalty − удержания
--   payout   = royalty − удержания − recouped, не меньше нуля
create or replace function public.recalc_royalty_statement(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  s public.royalty_statements;
  v_gross numeric(14, 2);
  v_royalty numeric(14, 2);
  v_net numeric(14, 2);
  v_balance numeric(14, 2);
  v_recouped numeric(14, 2);
begin
  select * into s from public.royalty_statements where id = p_id;
  if not found or s.status <> 'draft' then
    return;
  end if;

  select coalesce(sum(revenue), 0) into v_gross from public.royalty_lines where statement_id = p_id;
  v_royalty := round(v_gross * s.share_pct / 100, 2);
  v_net := greatest(v_royalty - s.deductions, 0);

  select coalesce((select sum(amount) from public.artist_advances where artist_id = s.artist_id), 0)
       - coalesce((select sum(recouped) from public.royalty_statements
                    where artist_id = s.artist_id and id <> p_id and status <> 'draft'), 0)
    into v_balance;

  v_recouped := least(greatest(v_balance, 0), v_net);

  update public.royalty_statements
     set gross = v_gross,
         royalty = v_royalty,
         recouped = v_recouped,
         payout = v_net - v_recouped
   where id = p_id;
end;
$function$;

-- Суммы в опубликованном отчёте не меняются; статус и служебные поля — да
create or replace function public.royalty_statements_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'UPDATE' then
    if old.status <> 'draft' and new.status <> 'draft' and (
         new.period_start is distinct from old.period_start
      or new.period_end is distinct from old.period_end
      or new.share_pct is distinct from old.share_pct
      or new.deductions is distinct from old.deductions
      or new.artist_id is distinct from old.artist_id
      -- суммы пишет только пересчёт, а он работает с черновиком
      or new.gross is distinct from old.gross
      or new.royalty is distinct from old.royalty
      or new.recouped is distinct from old.recouped
      or new.payout is distinct from old.payout) then
      raise exception 'Опубликованный отчёт не редактируется — верните его в черновик';
    end if;

    if old.status = 'paid' and new.status = 'draft' then
      raise exception 'Выплаченный отчёт сначала верните в «К выплате»';
    end if;

    if new.status = 'published' and old.status = 'draft' then
      new.published_at := now();
    end if;
    if new.status = 'paid' and old.status <> 'paid' then
      new.paid_at := coalesce(new.paid_at, now());
    end if;
    if new.status <> 'paid' then
      new.paid_at := null;
    end if;
    if new.status = 'draft' then
      new.published_at := null;
    end if;
  end if;
  return new;
end;
$function$;

create trigger royalty_statements_guard
  before update on public.royalty_statements
  for each row execute function public.royalty_statements_guard();

create or replace function public.royalty_statements_after_write()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- pg_trigger_depth: пересчёт сам делает update и не должен зациклиться
  if pg_trigger_depth() > 1 then
    return null;
  end if;
  if tg_op = 'INSERT' or new.status = 'draft' then
    perform public.recalc_royalty_statement(new.id);
  end if;
  -- Публикация или отзыв отчёта меняет остаток аванса — черновики артиста пересчитываются
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform public.recalc_royalty_statement(d.id)
       from public.royalty_statements d
      where d.artist_id = new.artist_id and d.status = 'draft' and d.id <> new.id;
  end if;
  return null;
end;
$function$;

create trigger royalty_statements_after_write
  after insert or update on public.royalty_statements
  for each row execute function public.royalty_statements_after_write();

create or replace function public.royalty_lines_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_statement uuid := coalesce(new.statement_id, old.statement_id);
begin
  if exists (select 1 from public.royalty_statements where id = v_statement and status <> 'draft') then
    raise exception 'Строки опубликованного отчёта не меняются — верните его в черновик';
  end if;
  return coalesce(new, old);
end;
$function$;

create trigger royalty_lines_guard
  before insert or update or delete on public.royalty_lines
  for each row execute function public.royalty_lines_guard();

create or replace function public.royalty_lines_after_write()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public.recalc_royalty_statement(coalesce(new.statement_id, old.statement_id));
  return null;
end;
$function$;

create trigger royalty_lines_after_write
  after insert or update or delete on public.royalty_lines
  for each row execute function public.royalty_lines_after_write();

-- Новый аванс меняет остаток — пересчитываем черновики артиста
create or replace function public.artist_advances_after_write()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
begin
  for r in
    select id from public.royalty_statements
     where artist_id = coalesce(new.artist_id, old.artist_id) and status = 'draft'
  loop
    perform public.recalc_royalty_statement(r.id);
  end loop;
  return null;
end;
$function$;

create trigger artist_advances_after_write
  after insert or update or delete on public.artist_advances
  for each row execute function public.artist_advances_after_write();

revoke execute on function public.recalc_royalty_statement(uuid) from public, anon, authenticated;

-- ── Доступ ─────────────────────────────────────────────────────────────────

alter table public.royalty_statements enable row level security;
alter table public.royalty_lines enable row level security;
alter table public.artist_advances enable row level security;

-- Артист видит только свои отчёты и только после публикации
create policy "royalty statements: select org or own published"
  on public.royalty_statements for select
  using (public.is_org_member(org_id) or (artist_id = public.my_artist_id() and status <> 'draft'));

create policy "royalty statements: insert org"
  on public.royalty_statements for insert
  with check (public.is_org_member(org_id));

create policy "royalty statements: update org"
  on public.royalty_statements for update
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "royalty statements: delete org draft"
  on public.royalty_statements for delete
  using (public.is_org_member(org_id) and status = 'draft');

create policy "royalty lines: select via statement"
  on public.royalty_lines for select
  using (exists (
    select 1 from public.royalty_statements s
     where s.id = statement_id
       and (public.is_org_member(s.org_id) or (s.artist_id = public.my_artist_id() and s.status <> 'draft'))
  ));

create policy "royalty lines: write org"
  on public.royalty_lines for all
  using (exists (select 1 from public.royalty_statements s where s.id = statement_id and public.is_org_member(s.org_id)))
  with check (exists (select 1 from public.royalty_statements s where s.id = statement_id and public.is_org_member(s.org_id)));

create policy "advances: select org or own"
  on public.artist_advances for select
  using (public.is_org_member(org_id) or artist_id = public.my_artist_id());

create policy "advances: write org"
  on public.artist_advances for all
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));
