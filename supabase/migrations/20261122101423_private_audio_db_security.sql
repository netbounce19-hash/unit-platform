-- PR 1: isolated private music player foundation. No public playback API.
-- Legacy artist-files policies intentionally unchanged; see security audit.
begin;

alter table public.assets
  add column track_type text not null default 'demo',
  add column visibility text not null default 'private',
  add column download_enabled boolean not null default false,
  add constraint assets_track_type_check check (track_type in ('demo','unreleased','released','exclusive')),
  add constraint assets_visibility_check check (visibility in ('private','unlisted','public'));

-- Do not add this schema to PostgREST's exposed schemas.
create schema private_audio;
revoke all on schema private_audio from public, anon, authenticated, service_role;

-- Inert until a later PR provisions a dedicated server login. Not granted to
-- authenticator or any browser role. No BYPASSRLS and no general service key.
create role unit_audio_backend nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant usage on schema private_audio, public, storage to unit_audio_backend;

create table private_audio.audio_playback_variants (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  storage_path text not null unique check (length(storage_path) between 1 and 512),
  source_fingerprint text not null check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  codec text not null default 'mp3' check (codec = 'mp3'),
  mime_type text not null default 'audio/mpeg' check (mime_type = 'audio/mpeg'),
  bitrate_kbps integer check (bitrate_kbps between 8 and 512),
  duration_ms bigint check (duration_ms > 0),
  size_bytes bigint check (size_bytes > 0),
  status text not null default 'pending' check (status in ('pending','processing','ready','failed')),
  error_code text check (error_code ~ '^[A-Z][A-Z0-9_]{0,63}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'ready' or (bitrate_kbps is not null and duration_ms is not null and size_bytes is not null)),
  check ((status = 'failed') = (error_code is not null)),
  unique (asset_id, source_fingerprint, codec)
);
create index audio_variants_work_idx on private_audio.audio_playback_variants(status, created_at)
  where status in ('pending','processing');

create table private_audio.audio_share_links (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  label text check (length(label) between 1 and 120),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  access_mode text not null default 'link' check (access_mode in ('link','pin')),
  -- Encoded adaptive hash (Argon2id or bcrypt); never plaintext PIN or SHA(PIN).
  pin_hash text check (length(pin_hash) between 20 and 1024 and
    (pin_hash like '$argon2id$%' or pin_hash ~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$')),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((access_mode = 'pin' and pin_hash is not null) or (access_mode = 'link' and pin_hash is null)),
  check (expires_at is null or expires_at > created_at),
  check (revoked_at is null or revoked_at >= created_at)
);
create index audio_links_asset_idx on private_audio.audio_share_links(asset_id, created_at desc);
create index audio_links_creator_idx on private_audio.audio_share_links(created_by);

create table private_audio.audio_playback_sessions (
  id uuid primary key default gen_random_uuid(),
  share_link_id uuid not null references private_audio.audio_share_links(id) on delete cascade,
  session_secret_hash text not null unique check (session_secret_hash ~ '^[0-9a-f]{64}$'),
  authorized_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > authorized_at and expires_at <= authorized_at + interval '30 minutes'),
  check (authorized_at >= created_at),
  check (revoked_at is null or revoked_at >= created_at),
  unique (id, share_link_id)
);
create index audio_sessions_link_idx on private_audio.audio_playback_sessions(share_link_id, expires_at);

create table private_audio.audio_play_events (
  id uuid primary key default gen_random_uuid(),
  share_link_id uuid not null references private_audio.audio_share_links(id) on delete cascade,
  session_id uuid,
  event_type text not null check (event_type in ('page_open','play_start','qualified_play','play_complete')),
  play_position_ms bigint not null default 0 check (play_position_ms >= 0),
  occurred_at timestamptz not null default now(),
  event_nonce uuid not null,
  foreign key (session_id, share_link_id)
    references private_audio.audio_playback_sessions(id, share_link_id) on delete cascade,
  check (event_type = 'page_open' or session_id is not null),
  unique (share_link_id, event_nonce)
);
create unique index audio_one_qualified_play_idx on private_audio.audio_play_events(session_id)
  where event_type = 'qualified_play';
create index audio_events_link_time_idx on private_audio.audio_play_events(share_link_id, occurred_at);
create index audio_events_session_idx on private_audio.audio_play_events(session_id, share_link_id);

-- Trigger functions are private, fixed-search-path, not callable by clients.
create function private_audio.guard_audio_reference()
returns trigger language plpgsql security definer set search_path = '' as $$
declare a public.assets;
begin
  -- Serialize against changing kind/owner or deleting the asset.
  select * into a from public.assets where id = new.asset_id for share;
  if not found then
    raise exception 'Audio asset does not exist' using errcode = '23503';
  end if;
  if a.kind <> 'audio' then
    raise exception 'Only audio assets are supported' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and (new.id is distinct from old.id or new.asset_id is distinct from old.asset_id) then
    raise exception 'Audio reference identity is immutable' using errcode = '23514';
  end if;
  if tg_table_name = 'audio_share_links' then
    if new.created_by <> a.owner_id then
      raise exception 'Only the asset owner can create a link' using errcode = '23514';
    end if;
  else
    if new.storage_path <> a.owner_id::text || '/' || a.id::text || '/' || new.id::text || '.mp3' then
      raise exception 'Invalid playback object path' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'UPDATE' then new.updated_at := now(); end if;
  return new;
end $$;
create trigger audio_variants_guard before insert or update on private_audio.audio_playback_variants
  for each row execute function private_audio.guard_audio_reference();
create trigger audio_links_guard before insert or update on private_audio.audio_share_links
  for each row execute function private_audio.guard_audio_reference();

-- Do not let the legacy org UPDATE policy rewrite publication settings.
-- Other existing asset edits remain unchanged. Identity changes with dependents
-- are refused, preserving the meaning of existing links and canonical paths.
create function private_audio.guard_asset_publication()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and auth.uid() <> old.owner_id and (
    new.track_type is distinct from old.track_type or new.visibility is distinct from old.visibility
    or new.download_enabled is distinct from old.download_enabled
  ) then
    raise exception 'Only the asset owner can change publication metadata' using errcode = '42501';
  end if;
  if (new.kind is distinct from old.kind or new.owner_id is distinct from old.owner_id or new.id is distinct from old.id)
    and (exists (select 1 from private_audio.audio_share_links where asset_id = old.id)
      or exists (select 1 from private_audio.audio_playback_variants where asset_id = old.id)) then
    raise exception 'Remove audio references before changing asset identity' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger assets_guard_audio_publication before update on public.assets
  for each row execute function private_audio.guard_asset_publication();

create function private_audio.guard_session()
returns trigger language plpgsql security definer set search_path = '' as $$
declare l private_audio.audio_share_links;
begin
  if tg_op = 'UPDATE' then
    -- A session cannot be moved, extended, reauthorized, or resurrected.
    if new.id is distinct from old.id or new.share_link_id is distinct from old.share_link_id
      or new.session_secret_hash is distinct from old.session_secret_hash
      or new.authorized_at is distinct from old.authorized_at
      or new.created_at is distinct from old.created_at
      or new.expires_at > old.expires_at
      or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at) then
      raise exception 'Session identity and authorization are immutable' using errcode = '23514';
    end if;
    return new;
  end if;
  -- FOR SHARE conflicts with link UPDATE: rotation/revocation cannot race issuance.
  select * into l from private_audio.audio_share_links where id = new.share_link_id for share;
  if not found then raise exception 'Unknown share link' using errcode = '23503'; end if;
  if l.revoked_at is not null or (l.expires_at is not null and l.expires_at <= now())
    or new.authorized_at > now() then
    raise exception 'Share link is not active' using errcode = '23514';
  end if;
  if l.expires_at is not null then new.expires_at := least(new.expires_at, l.expires_at); end if;
  return new;
end $$;
create trigger audio_sessions_guard before insert or update on private_audio.audio_playback_sessions
  for each row execute function private_audio.guard_session();

create function private_audio.invalidate_link_sessions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.token_hash is distinct from old.token_hash or new.pin_hash is distinct from old.pin_hash
    or new.access_mode is distinct from old.access_mode or new.revoked_at is distinct from old.revoked_at
    or new.expires_at is distinct from old.expires_at then
    update private_audio.audio_playback_sessions set revoked_at = now()
      where share_link_id = new.id and revoked_at is null;
  end if;
  return new;
end $$;
create trigger audio_links_invalidate_sessions after update on private_audio.audio_share_links
  for each row execute function private_audio.invalidate_link_sessions();

-- Stronger than absence of an allow policy: future permissive browser policies
-- on storage.objects cannot accidentally open this particular bucket.
insert into storage.buckets(id, name, public)
values ('audio-playback','audio-playback',false)
on conflict (id) do update set public = false;
create policy "audio playback: deny browser access" on storage.objects
  as restrictive for all to anon, authenticated
  using (bucket_id <> 'audio-playback') with check (bucket_id <> 'audio-playback');

create function private_audio.is_playback_object(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private_audio.audio_playback_variants v
    join public.assets a on a.id = v.asset_id
    where v.storage_path = p_name and a.kind = 'audio'
      and p_name = a.owner_id::text || '/' || a.id::text || '/' || v.id::text || '.mp3');
$$;
-- This role can operate only on registered playback paths, never artist-files.
create policy "audio playback: backend paths" on storage.objects for all to unit_audio_backend
  using (bucket_id = 'audio-playback' and private_audio.is_playback_object(name))
  with check (bucket_id = 'audio-playback' and private_audio.is_playback_object(name));
create policy "audio playback: backend bucket boundary" on storage.objects
  as restrictive for all to unit_audio_backend
  using (bucket_id = 'audio-playback') with check (bucket_id = 'audio-playback');
grant select, insert, update, delete on storage.objects to unit_audio_backend;

alter table private_audio.audio_playback_variants enable row level security;
alter table private_audio.audio_share_links enable row level security;
alter table private_audio.audio_playback_sessions enable row level security;
alter table private_audio.audio_play_events enable row level security;
create policy audio_variants_backend on private_audio.audio_playback_variants for all to unit_audio_backend
  using (true) with check (true);
create policy audio_links_backend on private_audio.audio_share_links for all to unit_audio_backend
  using (true) with check (true);
create policy audio_sessions_backend on private_audio.audio_playback_sessions for all to unit_audio_backend
  using (true) with check (true);
create policy audio_events_backend on private_audio.audio_play_events for all to unit_audio_backend
  using (true) with check (true);
revoke all on all tables in schema private_audio from public, anon, authenticated, service_role;
revoke all on all functions in schema private_audio from public, anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema private_audio to unit_audio_backend;
-- Analytics is append-only for the future request/worker role.
revoke update, delete on private_audio.audio_play_events from unit_audio_backend;
grant execute on function private_audio.is_playback_object(text) to unit_audio_backend;

-- Deliberately owner-executed view: invoker has no access to the secret tables.
-- The barrier and explicit uid predicate are the authorization boundary; no
-- org helper, global artist lookup, secret, variant path or session is exposed.
create view public.audio_share_link_metadata with (security_barrier = true) as
  select l.id, l.asset_id, l.created_by, l.label, l.access_mode,
    l.expires_at, l.revoked_at, l.created_at, l.updated_at
  from private_audio.audio_share_links l
  join public.assets a on a.id = l.asset_id
  where a.owner_id = (select auth.uid());
revoke all on public.audio_share_link_metadata from public, anon, authenticated, service_role;
grant select on public.audio_share_link_metadata to authenticated;
comment on view public.audio_share_link_metadata is
  'Owner-filtered, read-only projection. Definer view intentionally hides private tables. No hashes or paths.';
comment on schema private_audio is
  'Server-only audio internals. Never expose via PostgREST. No browser grants. Provision dedicated backend login in a later PR.';
comment on column public.assets.download_enabled is
  'Product permission only: does not prevent recording or retrieval of playable bytes. Legacy artist-files access is unchanged.';
commit;
