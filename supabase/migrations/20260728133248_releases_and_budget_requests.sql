-- Релизы и заявки на финансирование: перенос кабинета с клиентского стейта в БД.
-- Идемпотентна.

create table if not exists public.releases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'live')),
  release_date text,
  cover_path text,
  created_at timestamptz not null default now()
);
comment on table public.releases is 'Релизы артиста. cover_path — ключ в бакете artist-files.';
create index if not exists releases_owner_created_idx on public.releases (owner_id, created_at desc);

create table if not exists public.budget_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null,
  amount bigint not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now()
);
comment on table public.budget_requests is 'Заявки на финансирование. Статус меняет менеджер.';
create index if not exists budget_requests_owner_created_idx on public.budget_requests (owner_id, created_at desc);

-- Связь файла с релизом. Демо = аудио-ассет без release_id.
alter table public.assets add column if not exists release_id uuid references public.releases (id) on delete set null;

alter table public.releases enable row level security;
alter table public.budget_requests enable row level security;

-- releases: владелец видит и правит только свои строки
drop policy if exists "releases: owner select" on public.releases;
create policy "releases: owner select" on public.releases for select to authenticated using (auth.uid() = owner_id);
drop policy if exists "releases: owner insert" on public.releases;
create policy "releases: owner insert" on public.releases for insert to authenticated with check (auth.uid() = owner_id);
drop policy if exists "releases: owner update" on public.releases;
create policy "releases: owner update" on public.releases for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "releases: owner delete" on public.releases;
create policy "releases: owner delete" on public.releases for delete to authenticated using (auth.uid() = owner_id);

-- budget_requests: то же самое
drop policy if exists "budget: owner select" on public.budget_requests;
create policy "budget: owner select" on public.budget_requests for select to authenticated using (auth.uid() = owner_id);
drop policy if exists "budget: owner insert" on public.budget_requests;
create policy "budget: owner insert" on public.budget_requests for insert to authenticated with check (auth.uid() = owner_id);
drop policy if exists "budget: owner update" on public.budget_requests;
create policy "budget: owner update" on public.budget_requests for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "budget: owner delete" on public.budget_requests;
create policy "budget: owner delete" on public.budget_requests for delete to authenticated using (auth.uid() = owner_id);
