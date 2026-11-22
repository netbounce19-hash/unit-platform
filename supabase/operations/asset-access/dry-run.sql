-- READ ONLY. Run as trusted DB operator before considering backfill.sql.
-- No personal demo or org_id-only record qualifies. Returns no file content.
begin read only;
select count(*) as assets_total,
  count(*) filter(where release_id is null) as personal_or_unattached_no_backfill
from public.assets;
select count(*) as unambiguous_release_candidates from asset_access.release_grant_candidates;
select count(*) as candidates_without_any_grant_history
from asset_access.release_grant_candidates c
where not exists(select 1 from public.asset_org_grants g where g.asset_id=c.asset_id and g.org_id=c.org_id);
select a.id as excluded_asset_id,a.release_id,a.org_id
from public.assets a where a.release_id is not null
  and not exists(select 1 from asset_access.release_grant_candidates c where c.asset_id=a.id);
select storage_path,count(*) as shared_original_references,count(distinct org_id) as declared_organizations
from public.assets group by storage_path having count(*)>1;
commit;
