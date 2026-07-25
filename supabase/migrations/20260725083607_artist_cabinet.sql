-- Артистский кабинет: профили, ассеты, приватное хранилище и RLS.
-- Идемпотентна: безопасно применять повторно.

-- ── 1. Профили ─────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  artist_name text,
  created_at  timestamptz not null default now()
);

comment on table public.profiles is 'Профиль артиста, 1:1 с auth.users.';

-- ── 2. Автосоздание профиля при регистрации ────────────────────────────────

-- search_path пуст и зафиксирован: функция SECURITY DEFINER не должна
-- резолвить имена через пользовательский search_path.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, artist_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'artist_name', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ── 3. Ассеты (метаданные загруженных файлов) ──────────────────────────────

create table if not exists public.assets (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('audio', 'photo', 'document')),
  title        text,
  storage_path text not null,
  mime_type    text,
  size_bytes   bigint,
  created_at   timestamptz not null default now()
);

comment on table public.assets is
  'Метаданные файлов в бакете artist-files. storage_path = <user_id>/<kind>/<filename>.';

create index if not exists assets_owner_id_created_at_idx
  on public.assets (owner_id, created_at desc);

-- ── 4. Приватный бакет ─────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('artist-files', 'artist-files', false)
on conflict (id) do nothing;

-- ── 5. RLS ─────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.assets   enable row level security;

-- profiles: владелец видит и правит только свою строку.
-- INSERT не выдаём: строку создаёт триггер (SECURITY DEFINER).
drop policy if exists "profiles: owner can select" on public.profiles;
create policy "profiles: owner can select"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles: owner can update" on public.profiles;
create policy "profiles: owner can update"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- assets: полный CRUD в пределах своих строк.
drop policy if exists "assets: owner can select" on public.assets;
create policy "assets: owner can select"
  on public.assets for select
  to authenticated
  using (auth.uid() = owner_id);

drop policy if exists "assets: owner can insert" on public.assets;
create policy "assets: owner can insert"
  on public.assets for insert
  to authenticated
  with check (auth.uid() = owner_id);

drop policy if exists "assets: owner can update" on public.assets;
create policy "assets: owner can update"
  on public.assets for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "assets: owner can delete" on public.assets;
create policy "assets: owner can delete"
  on public.assets for delete
  to authenticated
  using (auth.uid() = owner_id);

-- ── 6. RLS на storage.objects ──────────────────────────────────────────────
-- Доступ только к своей папке верхнего уровня: <user_id>/...
-- storage.foldername(name) возвращает массив сегментов пути без имени файла.

drop policy if exists "artist-files: owner can select" on storage.objects;
create policy "artist-files: owner can select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'artist-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "artist-files: owner can insert" on storage.objects;
create policy "artist-files: owner can insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'artist-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "artist-files: owner can update" on storage.objects;
create policy "artist-files: owner can update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'artist-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'artist-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "artist-files: owner can delete" on storage.objects;
create policy "artist-files: owner can delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'artist-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
