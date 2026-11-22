-- PR 1.1 depends on PR 1. No automatic legacy backfill; review dry-run first.
begin;
create schema asset_access;
revoke all on schema asset_access from public, anon, authenticated;
grant usage on schema asset_access to authenticated;

create table public.asset_org_grants (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  granted_by uuid not null references auth.users(id) on delete cascade,
  permission text not null check (permission in ('view','manage')),
  grant_source text not null default 'owner' check (grant_source in ('owner','release','backfill')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz check (revoked_at >= created_at)
);
create unique index asset_grants_active_idx on public.asset_org_grants(asset_id,org_id) where revoked_at is null;
create index asset_grants_org_idx on public.asset_org_grants(org_id,asset_id) where revoked_at is null;
create index asset_grants_history_idx on public.asset_org_grants(asset_id,created_at desc);
create index asset_grants_grantor_idx on public.asset_org_grants(granted_by);
alter table public.asset_org_grants enable row level security;
revoke all on public.asset_org_grants from public,anon,authenticated;
grant select on public.asset_org_grants to authenticated;

-- A release cover has no assets row today. Register its EXACT object when the
-- owner submits a file to that release. A mutable release path is not authority.
create table asset_access.release_cover_objects (
  asset_id uuid not null references public.assets(id) on delete cascade,
  release_id uuid not null references public.releases(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  storage_path text not null,
  primary key (asset_id,release_id,storage_path)
);
create index release_cover_objects_release_idx on asset_access.release_cover_objects(release_id);
create index release_cover_objects_org_idx on asset_access.release_cover_objects(org_id);
create index release_cover_objects_path_idx on asset_access.release_cover_objects(storage_path);
alter table asset_access.release_cover_objects enable row level security;
revoke all on asset_access.release_cover_objects from public,anon,authenticated;

create function asset_access.is_owner(p_asset uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.assets a where a.id=p_asset and a.owner_id=auth.uid());
$$;
create function asset_access.can_read(p_asset uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.assets a where a.id=p_asset and (
      a.owner_id=auth.uid() or exists (
        select 1 from public.asset_org_grants g join public.memberships m on m.org_id=g.org_id
        where g.asset_id=a.id and g.revoked_at is null and g.granted_by=a.owner_id
          and m.user_id=auth.uid()
          and m.role in ('label_admin','label_manager','project','scout','delivery','marketing','finance'))));
$$;
create function asset_access.can_manage(p_asset uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.assets a where a.id=p_asset and (
      a.owner_id=auth.uid() or exists (
        select 1 from public.asset_org_grants g join public.memberships m on m.org_id=g.org_id
        where g.asset_id=a.id and g.revoked_at is null and g.granted_by=a.owner_id and g.permission='manage'
          and m.user_id=auth.uid() and m.role in ('label_admin','label_manager','project','delivery'))));
$$;
create policy "asset grants: owner or member read" on public.asset_org_grants for select to authenticated
  using (asset_access.is_owner(asset_id) or exists (
    select 1 from public.memberships m where m.org_id=asset_org_grants.org_id and m.user_id=(select auth.uid())));

-- Trigger enforces provenance even for service/backfill inserts. Browser roles
-- have no direct writes; they use the owner-checked RPCs below.
create function asset_access.guard_grant()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.assets where id=new.asset_id for update;
  if not found then raise exception 'Unknown asset' using errcode='23503'; end if;
  if new.granted_by <> v_owner or (auth.uid() is not null and auth.uid() <> v_owner) then
    raise exception 'Only owner can grant access' using errcode='42501';
  end if;
  if tg_op='UPDATE' and (
    new.id is distinct from old.id or new.asset_id is distinct from old.asset_id
    or new.org_id is distinct from old.org_id or new.granted_by is distinct from old.granted_by
    or new.permission is distinct from old.permission or new.created_at is distinct from old.created_at
    or new.grant_source is distinct from old.grant_source
    or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at)) then
    raise exception 'Grant history is immutable; revoke and issue a new grant' using errcode='23514';
  end if;
  return new;
end $$;
create trigger asset_grants_guard before insert or update on public.asset_org_grants
  for each row execute function asset_access.guard_grant();

create function public.grant_asset_to_org(p_asset_id uuid,p_org_id uuid,p_permission text default 'view')
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_id uuid;
begin
  select owner_id into v_owner from public.assets where id=p_asset_id for update;
  if auth.uid() is null or v_owner is distinct from auth.uid() then
    raise exception 'Only owner can share asset' using errcode='42501';
  end if;
  if p_permission is null or p_permission not in ('view','manage') then
    raise exception 'Unknown permission' using errcode='23514';
  end if;
  select id into v_id from public.asset_org_grants
    where asset_id=p_asset_id and org_id=p_org_id and revoked_at is null and permission=p_permission;
  if found then return v_id; end if;
  update public.asset_org_grants set revoked_at=now()
    where asset_id=p_asset_id and org_id=p_org_id and revoked_at is null;
  insert into public.asset_org_grants(asset_id,org_id,granted_by,permission)
    values(p_asset_id,p_org_id,auth.uid(),p_permission) returning id into v_id;
  return v_id;
end $$;
create function public.revoke_asset_org_grant(p_asset_id uuid,p_org_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.assets where id=p_asset_id for update;
  if auth.uid() is null or v_owner is distinct from auth.uid() then
    raise exception 'Only owner can revoke access' using errcode='42501';
  end if;
  update public.asset_org_grants set revoked_at=now()
    where asset_id=p_asset_id and org_id=p_org_id and revoked_at is null;
end $$;

-- Remove membership-derived permissions. Restrictive boundaries also neutralize
-- unknown legacy permissive policies; no blanket DROP of unrelated policies.
drop policy "assets: select own or org" on public.assets;
drop policy "assets: update own or org" on public.assets;
create policy "assets: explicit select" on public.assets for select to authenticated using(asset_access.can_read(id));
create policy "assets: explicit select boundary" on public.assets as restrictive for select to authenticated using(asset_access.can_read(id));
create policy "assets: explicit update" on public.assets for update to authenticated
  using(asset_access.can_manage(id)) with check(asset_access.can_manage(id));
create policy "assets: explicit update boundary" on public.assets as restrictive for update to authenticated
  using(asset_access.can_manage(id)) with check(asset_access.can_manage(id));
create policy "assets: anonymous deny" on public.assets as restrictive for all to anon using(false) with check(false);

create policy "assets: owner delete boundary" on public.assets as restrictive for delete to authenticated
  using(owner_id=(select auth.uid()));
create policy "assets: owner insert boundary" on public.assets as restrictive for insert to authenticated
  with check(owner_id=(select auth.uid()));

-- Reusable validation accepts only the existing {owner}/{kind}/{filename}
-- layout. No moving existing objects, no renaming or mass UPDATE.
create function asset_access.owned_path(p_path text,p_owner uuid,p_kind text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_path is not null and split_part(p_path,'/',1)=p_owner::text
    and split_part(p_path,'/',2)=p_kind and split_part(p_path,'/',3) not in ('','..','.')
    and split_part(p_path,'/',4)='' and p_path !~ '[\\]',false);
$$;

-- SECURITY INVOKER intentionally distinguishes ordinary table writes from
-- trusted migration/RPC writes. A client-set GUC is NOT an escape hatch.
create function asset_access.guard_asset()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('postgres','service_role') then return new; end if;
  if tg_op='UPDATE' then
    if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id
      or new.created_at is distinct from old.created_at then
      raise exception 'Asset identity is immutable' using errcode='42501';
    end if;
    if new.org_id is distinct from old.org_id or new.artist_id is distinct from old.artist_id
      or new.release_id is distinct from old.release_id then
      raise exception 'Use owner-authorized release attachment workflow' using errcode='42501';
    end if;
    if auth.uid() is distinct from old.owner_id then
      -- manage means TITLE ONLY; compare entire row excluding title so future
      -- columns cannot silently become label-editable.
      if (to_jsonb(new)-'title') is distinct from (to_jsonb(old)-'title') then
        raise exception 'Manage permits title changes only' using errcode='42501';
      end if;
      return new;
    end if;
    if new.kind is distinct from old.kind then
      raise exception 'Asset kind is immutable' using errcode='42501';
    end if;
  else
    if new.owner_id is distinct from auth.uid() then raise exception 'Owner mismatch' using errcode='42501'; end if;
    if new.org_id is not null or new.artist_id is not null or new.release_id is not null then
      raise exception 'Upload privately, then explicitly attach/share' using errcode='42501';
    end if;
  end if;
  if tg_op='INSERT' or new.storage_path is distinct from old.storage_path then
    if not asset_access.owned_path(new.storage_path,new.owner_id,new.kind)
      or not exists(select 1 from storage.objects where bucket_id='artist-files' and name=new.storage_path) then
      raise exception 'Original must be an uploaded object in owner folder' using errcode='23514';
    end if;
  end if;
  if (tg_op='INSERT' or new.cover_path is distinct from old.cover_path) and new.cover_path is not null then
    if not asset_access.owned_path(new.cover_path,new.owner_id,'photo')
      or not exists(select 1 from storage.objects where bucket_id='artist-files' and name=new.cover_path) then
      raise exception 'Cover must be an uploaded photo in owner folder' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
create trigger assets_guard_identity before insert or update on public.assets
  for each row execute function asset_access.guard_asset();

-- Full object authorization, not folder-wide membership authorization.
create function asset_access.can_read_object(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    split_part(p_name,'/',1)=auth.uid()::text or exists (
      select 1 from public.asset_org_grants g
      join public.assets a on a.id=g.asset_id
      join public.memberships m on m.org_id=g.org_id and m.user_id=auth.uid()
      where g.revoked_at is null and g.granted_by=a.owner_id
        and m.role in ('label_admin','label_manager','project','scout','delivery','marketing','finance')
        and split_part(p_name,'/',1)=a.owner_id::text
        and (p_name=a.storage_path or p_name=a.cover_path or exists (
          select 1 from asset_access.release_cover_objects c join public.releases r on r.id=c.release_id
          where c.asset_id=a.id and c.org_id=g.org_id and c.storage_path=p_name
            and a.release_id=r.id and r.owner_id=a.owner_id and r.org_id=c.org_id
            and r.cover_path=c.storage_path))));
$$;
-- Retire old folder helper without leaving its insecure semantics callable.
create or replace function public.can_access_user_folder(p_folder text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and p_folder=auth.uid()::text;
$$;
-- Public bucket serving bypasses SELECT RLS: close any legacy configuration drift.
update storage.buckets set public=false where id='artist-files';
drop policy "artist-files: select owner or org" on storage.objects;
create policy "artist-files: explicit object select" on storage.objects for select to authenticated
  using(bucket_id='artist-files' and asset_access.can_read_object(name));
create policy "artist-files: explicit object boundary" on storage.objects as restrictive for select to authenticated
  using(bucket_id<>'artist-files' or asset_access.can_read_object(name));
create policy "artist-files: owner insert boundary" on storage.objects as restrictive for insert to authenticated
  with check(bucket_id<>'artist-files' or split_part(name,'/',1)=(select auth.uid())::text);
create policy "artist-files: owner update boundary" on storage.objects as restrictive for update to authenticated
  using(bucket_id<>'artist-files' or split_part(name,'/',1)=(select auth.uid())::text)
  with check(bucket_id<>'artist-files' or split_part(name,'/',1)=(select auth.uid())::text);
create policy "artist-files: owner delete boundary" on storage.objects as restrictive for delete to authenticated
  using(bucket_id<>'artist-files' or split_part(name,'/',1)=(select auth.uid())::text);
create policy "artist-files: anonymous deny" on storage.objects as restrictive for all to anon
  using(bucket_id<>'artist-files') with check(bucket_id<>'artist-files');

-- Explicit owner workflow: release attachment + grant + exact cover registration
-- commit together. No hidden grant on an ordinary asset or release UPDATE.
create function public.attach_asset_to_release(p_asset_id uuid,p_release_id uuid,p_clean boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.assets; r public.releases;
begin
  select * into a from public.assets where id=p_asset_id for update;
  if auth.uid() is null or a.owner_id is distinct from auth.uid() then
    raise exception 'Only owner can attach asset' using errcode='42501';
  end if;
  select * into r from public.releases where id=p_release_id for share;
  if not found or r.owner_id is distinct from auth.uid() then
    raise exception 'Release must belong to asset owner' using errcode='42501';
  end if;
  if r.org_id is not null and not exists(select 1 from public.artists ar
    where ar.id=r.artist_id and ar.org_id=r.org_id and ar.user_id=auth.uid()) then
    raise exception 'Release organization/artist mismatch' using errcode='23514';
  end if;
  if (a.org_id is not null and a.org_id is distinct from r.org_id)
    or (a.artist_id is not null and a.artist_id is distinct from r.artist_id) then
    raise exception 'Existing asset association conflicts with release' using errcode='23514';
  end if;
  if not asset_access.owned_path(a.storage_path,a.owner_id,a.kind) or
    not exists(select 1 from storage.objects where bucket_id='artist-files' and name=a.storage_path) then
    raise exception 'Invalid original object' using errcode='23514';
  end if;
  if r.cover_path is not null and (not asset_access.owned_path(r.cover_path,a.owner_id,'photo') or
    not exists(select 1 from storage.objects where bucket_id='artist-files' and name=r.cover_path)) then
    raise exception 'Invalid release cover' using errcode='23514';
  end if;
  update public.assets set release_id=r.id,is_clean_version=(p_clean is true) where id=a.id;
  if r.org_id is not null then
    -- Preserve an owner's existing stronger grant; a submission is not a
    -- silent permission downgrade. Explicit resubmission can re-issue a revoked grant.
    if not exists(select 1 from public.asset_org_grants g
      where g.asset_id=a.id and g.org_id=r.org_id and g.revoked_at is null) then
      insert into public.asset_org_grants(asset_id,org_id,granted_by,permission,grant_source)
        values(a.id,r.org_id,auth.uid(),'view','release');
    end if;
    if r.cover_path is not null then
      insert into asset_access.release_cover_objects(asset_id,release_id,org_id,storage_path)
        values(a.id,r.id,r.org_id,r.cover_path) on conflict do nothing;
    end if;
  end if;
end $$;

-- Conservative candidate list, visible ONLY to trusted operators. No grant is
-- created by this migration. Dry-run/report and explicit approval precede backfill.
create view asset_access.release_grant_candidates as
select a.id asset_id,a.owner_id,r.id release_id,r.org_id,r.cover_path
from public.assets a join public.releases r on r.id=a.release_id
join public.artists ar on ar.id=r.artist_id and ar.org_id=r.org_id and ar.user_id=a.owner_id
where r.owner_id=a.owner_id and r.org_id is not null
  and (a.org_id is null or a.org_id=r.org_id) and (a.artist_id is null or a.artist_id=ar.id)
  and asset_access.owned_path(a.storage_path,a.owner_id,a.kind)
  and exists(select 1 from storage.objects where bucket_id='artist-files' and name=a.storage_path)
  and (a.cover_path is null or (asset_access.owned_path(a.cover_path,a.owner_id,'photo')
    and exists(select 1 from storage.objects where bucket_id='artist-files' and name=a.cover_path)))
  and not exists(select 1 from public.assets other where other.id<>a.id and other.storage_path=a.storage_path)
  and (r.cover_path is null or (asset_access.owned_path(r.cover_path,a.owner_id,'photo')
    and exists(select 1 from storage.objects where bucket_id='artist-files' and name=r.cover_path)));
revoke all on asset_access.release_grant_candidates from public,anon,authenticated,service_role;

-- Functions not explicitly granted here cannot be called by browsers.
revoke all on all functions in schema asset_access from public,anon,authenticated;
grant execute on function asset_access.is_owner(uuid),asset_access.can_read(uuid),asset_access.can_manage(uuid),
  asset_access.can_read_object(text),asset_access.owned_path(text,uuid,text) to authenticated;
revoke all on function public.grant_asset_to_org(uuid,uuid,text),public.revoke_asset_org_grant(uuid,uuid),
  public.attach_asset_to_release(uuid,uuid,boolean) from public,anon;
grant execute on function public.grant_asset_to_org(uuid,uuid,text),public.revoke_asset_org_grant(uuid,uuid),
  public.attach_asset_to_release(uuid,uuid,boolean) to authenticated;
comment on table public.asset_org_grants is 'Explicit owner-authorized access. Membership alone gives no file access. manage permits title only.';
comment on table asset_access.release_cover_objects is 'Exact owner-authorized release cover paths, not folder or mutable-release-path access.';
commit;
