-- Synthetic records created BEFORE hardening, never on a live database.
insert into auth.users(id,email) select md5(n)::uuid,n || '@example.invalid'
from unnest(array['legacy-owner','legacy-label','legacy-other']) n;
insert into public.organizations(id,name) values(md5('legacy-org')::uuid,'Legacy label');
insert into public.memberships(org_id,user_id,role) values(md5('legacy-org')::uuid,md5('legacy-label')::uuid,'label_admin');
insert into public.artists(id,org_id,user_id,stage_name) values(md5('legacy-artist')::uuid,md5('legacy-org')::uuid,md5('legacy-owner')::uuid,'Legacy owner');
insert into public.releases(id,owner_id,org_id,artist_id,title,cover_path)
values(md5('legacy-release')::uuid,md5('legacy-owner')::uuid,md5('legacy-org')::uuid,md5('legacy-artist')::uuid,'Legacy release',md5('legacy-owner')::uuid || '/photo/release.png');
insert into public.assets(id,owner_id,kind,storage_path,release_id,cover_path)
select md5(n)::uuid,md5('legacy-owner')::uuid,'audio',md5('legacy-owner')::uuid || '/audio/' || n || '.wav',
 case when n in ('legacy-ok','legacy-conflict','legacy-missing','legacy-revoked') then md5('legacy-release')::uuid end,
 md5('legacy-owner')::uuid || '/photo/demo.png'
from unnest(array['legacy-ok','legacy-private','legacy-conflict','legacy-missing','legacy-revoked']) n;
update public.assets set owner_id=md5('legacy-other')::uuid where id=md5('legacy-conflict')::uuid;
insert into storage.objects(bucket_id,name)
select 'artist-files',storage_path from public.assets where id<>md5('legacy-missing')::uuid;
insert into storage.objects(bucket_id,name) values
 ('artist-files',md5('legacy-owner')::uuid || '/photo/release.png'),
 ('artist-files',md5('legacy-owner')::uuid || '/photo/demo.png');
