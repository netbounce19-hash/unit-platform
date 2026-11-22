-- MANUAL psql operation, NOT a migration. Inspect dry-run.sql first.
-- Explicit operator opt-in; never invoked by app, migrations or test runner.
\if :{?apply_asset_backfill}
\else
  \echo 'Review dry-run.sql, then pass -v apply_asset_backfill=true on the approved database.'
  \quit 2
\endif
\if :apply_asset_backfill
\else
  \quit 2
\endif
\set ON_ERROR_STOP on
begin;
-- Prevent association/path changes between candidate evaluation and insertion.
lock table public.assets,public.asset_org_grants,public.releases,public.artists,storage.objects in share row exclusive mode;
with issued as (
  insert into public.asset_org_grants(asset_id,org_id,granted_by,permission,grant_source)
  select c.asset_id,c.org_id,c.owner_id,'view','backfill'
  from asset_access.release_grant_candidates c
  -- Do not resurrect revoked grants or replace an owner's existing decision.
  where not exists(select 1 from public.asset_org_grants g where g.asset_id=c.asset_id and g.org_id=c.org_id)
  on conflict (asset_id,org_id) where revoked_at is null do nothing
  returning asset_id,org_id
)
insert into asset_access.release_cover_objects(asset_id,release_id,org_id,storage_path)
select c.asset_id,c.release_id,c.org_id,c.cover_path
from asset_access.release_grant_candidates c join issued i using(asset_id,org_id)
where c.cover_path is not null on conflict do nothing;
commit;
