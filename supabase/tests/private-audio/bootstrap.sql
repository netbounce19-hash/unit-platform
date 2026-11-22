-- ONLY for disposable PostgreSQL/PGlite, never an existing Supabase database.
-- Minimal Auth/Storage contracts; does not emulate HTTP, JWT verification or S3.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
create table auth.users (
  id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth, storage, public to anon, authenticated, service_role;
grant execute on function auth.uid() to public;
create table storage.buckets(id text primary key, name text not null, public boolean not null default false);
create table storage.objects(
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null,
  unique(bucket_id, name)
);
create function storage.foldername(text) returns text[] language sql immutable as $$
  select (string_to_array($1, '/'))[1:array_length(string_to_array($1, '/'), 1)-1]
$$;
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
-- Legacy Supabase auto-grants, intentionally hostile to verify explicit revokes.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
