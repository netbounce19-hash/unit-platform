-- PostgREST INSERT ... RETURNING must authorize the new row directly.
-- STABLE helpers querying assets cannot see that row in the INSERT snapshot.
-- Keep grant checks for non-owners and the restrictive anti-drift boundary.
begin;
alter policy "assets: explicit select" on public.assets
  using (owner_id = (select auth.uid()) or asset_access.can_read(id));
alter policy "assets: explicit select boundary" on public.assets
  using (owner_id = (select auth.uid()) or asset_access.can_read(id));
commit;
