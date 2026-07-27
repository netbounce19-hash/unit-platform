-- Роль аккаунта (артист / лейбл) и telegram для будущих уведомлений.
-- Идемпотентна: безопасно применять повторно.

-- ── 1. Новые колонки ───────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists role text not null default 'artist',
  add column if not exists telegram text;

comment on column public.profiles.role is 'artist | label — кем пользователь зарегистрировался.';
comment on column public.profiles.telegram is 'Telegram-username без @, для будущих уведомлений.';

-- Ограничение добавляем отдельно: add column ... check не идемпотентен.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('artist', 'label'));
  end if;
end
$$;

-- ── 2. Триггер учитывает role и telegram ───────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, artist_name, role, telegram)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'artist_name', ''),
    -- неизвестную роль тихо не принимаем, откатываемся на artist
    case
      when new.raw_user_meta_data ->> 'role' in ('artist', 'label')
        then new.raw_user_meta_data ->> 'role'
      else 'artist'
    end,
    nullif(ltrim(new.raw_user_meta_data ->> 'telegram', '@'), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
