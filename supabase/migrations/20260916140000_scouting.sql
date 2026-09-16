-- Скаутинг: демо от артистов вне ростера и воронка A&R.
--
-- Главная сложность отрасли — в огромном потоке треков разглядеть того, в
-- кого стоит вложиться. У лейбла появляется публичная ссылка «Прислать демо»,
-- а у команды — воронка: новые → слушаем → шортлист → предложение →
-- подписан / отказ. Скауты заводят и свои находки.
--
-- Форму заполняют люди без аккаунта, поэтому вставка идёт только через
-- submit_demo(): проверка полей, согласие на обработку персональных данных
-- (152-ФЗ) и ограничение частоты. Прямого доступа к таблице у anon нет.

alter table public.organizations
  add column slug text unique
    check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  add column submissions_open boolean not null default false,
  add column submissions_intro text check (char_length(submissions_intro) <= 600);

create table public.demo_submissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  source text not null default 'form' check (source in ('form', 'scout')),
  artist_name text not null check (char_length(artist_name) between 1 and 100),
  contact_name text check (char_length(contact_name) <= 100),
  email text check (char_length(email) <= 200),
  telegram text check (char_length(telegram) <= 64),
  city text check (char_length(city) <= 80),
  genre text check (char_length(genre) <= 80),
  track_url text not null check (track_url ~ '^https?://' and char_length(track_url) <= 500),
  links text[] not null default '{}' check (cardinality(links) <= 6),
  followers integer check (followers >= 0),
  monthly_listeners integer check (monthly_listeners >= 0),
  message text check (char_length(message) <= 2000),
  status text not null default 'new'
    check (status in ('new', 'listening', 'shortlist', 'offer', 'signed', 'declined')),
  rating smallint check (rating between 1 and 5),
  notes text check (char_length(notes) <= 4000),
  assigned_to uuid references auth.users (id) on delete set null,
  invite_id uuid references public.artist_invites (id) on delete set null,
  consent_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz
);

create index demo_submissions_org_status_idx on public.demo_submissions (org_id, status, created_at desc);
create index demo_submissions_email_idx on public.demo_submissions (org_id, lower(email), created_at);

create or replace function public.demo_submissions_touch()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at := now();
  if new.status is distinct from old.status and new.status in ('signed', 'declined') then
    new.decided_at := now();
  elsif new.status not in ('signed', 'declined') then
    new.decided_at := null;
  end if;
  return new;
end;
$function$;

create trigger demo_submissions_touch
  before update on public.demo_submissions
  for each row execute function public.demo_submissions_touch();

alter table public.demo_submissions enable row level security;

create policy "demos: org select"
  on public.demo_submissions for select
  using (public.is_org_member(org_id));

-- Команда лейбла сама заводит только находки скаутов
create policy "demos: org insert scout finds"
  on public.demo_submissions for insert
  with check (public.is_org_member(org_id) and source = 'scout');

create policy "demos: org update"
  on public.demo_submissions for update
  using (public.is_org_member(org_id))
  with check (public.is_org_member(org_id));

create policy "demos: org delete"
  on public.demo_submissions for delete
  using (public.is_org_member(org_id));

-- ── Публичная часть ────────────────────────────────────────────────────────

-- Страница «Прислать демо» знает о лейбле только название и открыт ли приём
create or replace function public.public_label(p_slug text)
returns table (name text, submissions_open boolean, submissions_intro text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select o.name, o.submissions_open, o.submissions_intro
    from public.organizations o
   where o.slug = lower(p_slug);
$function$;

create or replace function public.submit_demo(
  p_slug text,
  p_artist_name text,
  p_email text,
  p_track_url text,
  p_consent boolean,
  p_contact_name text default null,
  p_telegram text default null,
  p_city text default null,
  p_genre text default null,
  p_links text[] default '{}',
  p_followers integer default null,
  p_monthly_listeners integer default null,
  p_message text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_org public.organizations;
  v_email text := lower(trim(p_email));
  v_links text[];
begin
  select * into v_org from public.organizations where slug = lower(p_slug);
  if not found or not v_org.submissions_open then
    raise exception 'Лейбл сейчас не принимает демо';
  end if;

  if coalesce(p_consent, false) is not true then
    raise exception 'Нужно согласие на обработку персональных данных';
  end if;
  if char_length(trim(coalesce(p_artist_name, ''))) = 0 then
    raise exception 'Укажите имя артиста';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Проверьте почту';
  end if;
  if coalesce(p_track_url, '') !~ '^https?://' then
    raise exception 'Нужна ссылка на трек — начинается с https://';
  end if;

  select coalesce(array_agg(trim(l)), '{}') into v_links
    from unnest(coalesce(p_links, '{}')) as l
   where trim(l) ~ '^https?://' and char_length(trim(l)) <= 500;

  -- Защита от спама: не больше 3 заявок с одной почты в сутки
  -- и не больше 60 на лейбл в час
  if (select count(*) from public.demo_submissions
       where org_id = v_org.id and lower(email) = v_email
         and created_at > now() - interval '1 day') >= 3 then
    raise exception 'С этой почты уже отправлено несколько демо — попробуйте завтра';
  end if;
  if (select count(*) from public.demo_submissions
       where org_id = v_org.id and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Слишком много заявок — попробуйте через час';
  end if;

  insert into public.demo_submissions (
    org_id, source, artist_name, contact_name, email, telegram, city, genre,
    track_url, links, followers, monthly_listeners, message, consent_at
  ) values (
    -- длинные поля обрезаем, а не роняем отправку
    v_org.id, 'form', left(trim(p_artist_name), 100), nullif(left(trim(p_contact_name), 100), ''),
    left(v_email, 200),
    nullif(left(regexp_replace(trim(coalesce(p_telegram, '')), '^@', ''), 64), ''),
    nullif(left(trim(p_city), 80), ''), nullif(left(trim(p_genre), 80), ''),
    left(trim(p_track_url), 500), v_links[1:6],
    -- пусто или отрицательно — «не указано», а не ноль
    nullif(greatest(coalesce(p_followers, -1), -1), -1),
    nullif(greatest(coalesce(p_monthly_listeners, -1), -1), -1),
    nullif(left(trim(p_message), 2000), ''), now()
  );
end;
$function$;

revoke all on function public.submit_demo(text, text, text, text, boolean, text, text, text, text, text[], integer, integer, text) from public;
grant execute on function public.submit_demo(text, text, text, text, boolean, text, text, text, text, text[], integer, integer, text) to anon, authenticated;
revoke all on function public.public_label(text) from public;
grant execute on function public.public_label(text) to anon, authenticated;
