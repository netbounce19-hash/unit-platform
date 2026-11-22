-- DISPOSABLE database only. SQL/RLS tests, NOT Storage HTTP verification.
begin;
create function pg_temp.uid(label text) returns uuid language sql immutable as $$ select md5(label)::uuid $$;
create function pg_temp.assert_true(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if; end $$;
create function pg_temp.expect_error(statement text,expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate=expected then return; end if;
    raise exception 'Expected %, got %: %',expected,sqlstate,sqlerrm;
  end;
  raise exception 'Expected %, statement succeeded: %',expected,statement;
end $$;
select pg_temp.assert_true((select count(*)=0 from public.asset_org_grants),'migration creates NO automatic grants');
insert into auth.users(id,email) select pg_temp.uid(n),n || '@example.invalid' from unnest(array['hard-a','hard-b','hard-la','hard-lb','hard-finance']) n;
insert into public.organizations(id,name) values(pg_temp.uid('hard-oa'),'A'),(pg_temp.uid('hard-ob'),'B');
insert into public.memberships(org_id,user_id,role) values
(pg_temp.uid('hard-oa'),pg_temp.uid('hard-la'),'label_admin'),
(pg_temp.uid('hard-ob'),pg_temp.uid('hard-lb'),'label_admin'),
(pg_temp.uid('hard-oa'),pg_temp.uid('hard-finance'),'finance');

select pg_temp.expect_error($q$insert into public.asset_org_grants(asset_id,org_id,granted_by,permission)
values(pg_temp.uid('missing'),pg_temp.uid('hard-oa'),pg_temp.uid('hard-a'),'view')$q$,'23503');

-- A: independent owner uploads privately BEFORE the asset row exists.
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.uid('hard-a')::text,true);
insert into storage.objects(bucket_id,name) values
('artist-files',pg_temp.uid('hard-a') || '/audio/personal.wav'),
('artist-files',pg_temp.uid('hard-a') || '/audio/replacement.wav'),
('artist-files',pg_temp.uid('hard-a') || '/photo/cover.png'),
('artist-files',pg_temp.uid('hard-a') || '/photo/replacement.png'),
('artist-files',pg_temp.uid('hard-a') || '/photo/neighbor.png'),
('artist-files',pg_temp.uid('hard-a') || '/photo/release.png');
insert into public.assets(id,owner_id,kind,storage_path,title)
values(pg_temp.uid('hard-track'),pg_temp.uid('hard-a'),'audio',pg_temp.uid('hard-a') || '/audio/personal.wav','Private');
select pg_temp.assert_true((select count(*)=1 from public.assets where id=pg_temp.uid('hard-track')),'independent artist reads own asset');
select set_config('request.jwt.claim.sub',pg_temp.uid('hard-la')::text,true);
select pg_temp.assert_true((select count(*)=0 from public.assets where id=pg_temp.uid('hard-track')),'independent artist hidden from Label A');
select pg_temp.assert_true((select count(*)=0 from storage.objects where bucket_id='artist-files' and name like pg_temp.uid('hard-a') || '/%'),'independent objects hidden');
select set_config('request.jwt.claim.sub',pg_temp.uid('hard-lb')::text,true);
select pg_temp.assert_true((select count(*)=0 from public.assets where id=pg_temp.uid('hard-track')),'independent artist hidden from Label B');
reset role;
select set_config('request.jwt.claim.sub','',true);

-- B: adding two artist↔org relations does not alter file access.
insert into public.artists(id,org_id,user_id,stage_name) values
(pg_temp.uid('hard-aa'),pg_temp.uid('hard-oa'),pg_temp.uid('hard-a'),'A'),
(pg_temp.uid('hard-ab'),pg_temp.uid('hard-ob'),pg_temp.uid('hard-a'),'A');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.uid('hard-la')::text,true);
select pg_temp.assert_true(not public.can_access_user_folder(pg_temp.uid('hard-a')::text),'old folder helper no longer grants membership access');
select pg_temp.assert_true((select count(*)=0 from public.assets where id=pg_temp.uid('hard-track')),'two labels do not reveal personal asset');
select pg_temp.assert_true(not asset_access.can_read_object(pg_temp.uid('hard-a') || '/audio/personal.wav'),'original denied without grant');
select pg_temp.expect_error($q$select public.grant_asset_to_org(pg_temp.uid('hard-track'),pg_temp.uid('hard-oa'),'manage')$q$,'42501');
select pg_temp.expect_error($q$insert into public.asset_org_grants(asset_id,org_id,granted_by,permission) values(pg_temp.uid('hard-track'),pg_temp.uid('hard-oa'),pg_temp.uid('hard-a'),'manage')$q$,'42501');
select set_config('request.jwt.claim.sub',pg_temp.uid('hard-lb')::text,true);
select pg_temp.assert_true(not asset_access.can_read_object(pg_temp.uid('hard-a') || '/audio/personal.wav'),'Label B also denied');

-- F: existing rename, sort, cover and replacement UPDATE paths remain owner-only.
select set_config('request.jwt.claim.sub',pg_temp.uid('hard-a')::text,true);
update public.assets set title='Renamed',sort_order=-1,cover_path=pg_temp.uid('hard-a') || '/photo/cover.png' where id=pg_temp.uid('hard-track');
update public.assets set storage_path=pg_temp.uid('hard-a') || '/audio/replacement.wav',mime_type='audio/wav',size_bytes=1234 where id=pg_temp.uid('hard-track');
update public.assets set cover_path=pg_temp.uid('hard-a') || '/photo/replacement.png' where id=pg_temp.uid('hard-track');
select pg_temp.assert_true((select title='Renamed' and sort_order=-1 and size_bytes=1234 from public.assets where id=pg_temp.uid('hard-track')),'demo updates work');
select pg_temp.expect_error($q$update public.assets set storage_path=pg_temp.uid('hard-b') || '/audio/other.wav' where id=pg_temp.uid('hard-track')$q$,'23514');
select pg_temp.expect_error($q$update public.assets set cover_path=pg_temp.uid('hard-b') || '/photo/other.png' where id=pg_temp.uid('hard-track')$q$,'23514');
select pg_temp.expect_error($q$update public.assets set storage_path=pg_temp.uid('hard-a') || '/audio/missing.wav' where id=pg_temp.uid('hard-track')$q$,'23514');
select pg_temp.expect_error($q$update public.assets set owner_id=pg_temp.uid('hard-b') where id=pg_temp.uid('hard-track')$q$,'42501');

-- C/G: explicit grant, exact original/cover only, no neighboring objects.
select public.grant_asset_to_org(pg_temp.uid('hard-track'),pg_temp.uid('hard-oa'),'view');
select set_config('request.jwt.claim.sub',pg_temp.uid('hard-la')::text,true);
select pg_temp.assert_true((select count(*)=1 from public.assets where id=pg_temp.uid('hard-track')),'Label A reads granted metadata');
select pg_temp.assert_true(asset_access.can_read_object(pg_temp.uid('hard-a') || '/audio/replacement.wav'),'granted original readable');
select pg_temp.assert_true(asset_access.can_read_object(pg_temp.uid('hard-a') || '/photo/replacement.png'),'parent grant reveals only current cover');
select pg_temp.assert_true(not asset_access.can_read_object(pg_temp.uid('hard-a') || '/photo/neighbor.png'),'neighbor photo denied');
select pg_temp.assert_true(not asset_access.can_read_object(pg_temp.uid('hard-a') || '/audio/personal.wav'),'old audio path denied');
with changed as(update public.assets set title='No view write' where id=pg_temp.uid('hard-track') returning id)
select pg_temp.assert_true((select count(*)=0 from changed),'view cannot update title');
select set_config('request.jwt.claim.sub',pg_temp.uid('hard-lb')::text,true);
select pg_temp.assert_true((select count(*)=0 from public.assets where id=pg_temp.uid('hard-track')),'Label B denied despite membership');
select pg_temp.assert_true((select count(*)=0 from public.asset_org_grants),'Label B cannot read Label A grants');
select set_config('request.jwt.claim.sub',pg_temp.uid('hard-b')::text,true);
select pg_temp.expect_error($q$select public.revoke_asset_org_grant(pg_temp.uid('hard-track'),pg_temp.uid('hard-oa'))$q$,'42501');
select pg_temp.expect_error($q$select public.grant_asset_to_org(pg_temp.uid('hard-track'),pg_temp.uid('hard-ob'),'view')$q$,'42501');

-- E: manage is title-only and subject to organization role.
select set_config('request.jwt.claim.sub',pg_temp.uid('hard-a')::text,true);
select public.grant_asset_to_org(pg_temp.uid('hard-track'),pg_temp.uid('hard-oa'),'manage');
select pg_temp.assert_true((select count(*)=2 from public.asset_org_grants where asset_id=pg_temp.uid('hard-track')),'permission changes preserve history');
select set_config('request.jwt.claim.sub',pg_temp.uid('hard-la')::text,true);
update public.assets set title='Label title' where id=pg_temp.uid('hard-track');
select pg_temp.expect_error($q$update public.assets set owner_id=pg_temp.uid('hard-la') where id=pg_temp.uid('hard-track')$q$,'42501');
select pg_temp.expect_error($q$update public.assets set storage_path=pg_temp.uid('hard-a') || '/audio/personal.wav' where id=pg_temp.uid('hard-track')$q$,'42501');
select pg_temp.expect_error($q$update public.assets set org_id=pg_temp.uid('hard-ob') where id=pg_temp.uid('hard-track')$q$,'42501');
select pg_temp.expect_error($q$update public.assets set artist_id=pg_temp.uid('hard-ab') where id=pg_temp.uid('hard-track')$q$,'42501');
select pg_temp.expect_error($q$update public.assets set created_at=created_at-interval '1 day' where id=pg_temp.uid('hard-track')$q$,'42501');
select pg_temp.expect_error($q$update public.assets set cover_path=pg_temp.uid('hard-a') || '/photo/neighbor.png' where id=pg_temp.uid('hard-track')$q$,'42501');
select pg_temp.expect_error($q$update public.assets set is_clean_version=true where id=pg_temp.uid('hard-track')$q$,'42501');
with removed as(delete from public.assets where id=pg_temp.uid('hard-track') returning id)
select pg_temp.assert_true((select count(*)=0 from removed),'manage cannot delete asset');
select set_config('request.jwt.claim.sub',pg_temp.uid('hard-finance')::text,true);
with changed as(update public.assets set title='Finance write' where id=pg_temp.uid('hard-track') returning id)
select pg_temp.assert_true((select count(*)=0 from changed),'finance has no manage writes');

-- H: SQL policies underlying Storage read/list/sign, upload, move, copy/delete.
select set_config('request.jwt.claim.sub',pg_temp.uid('hard-la')::text,true);
select pg_temp.assert_true((select count(*)=2 from storage.objects where name like pg_temp.uid('hard-a') || '/%'),'only granted original and cover can be listed');
select pg_temp.expect_error($q$insert into storage.objects(bucket_id,name) values('artist-files',pg_temp.uid('hard-a') || '/audio/injected.wav')$q$,'42501');
with changed as(update storage.objects set name=pg_temp.uid('hard-la') || '/audio/stolen.wav' where name=pg_temp.uid('hard-a') || '/audio/replacement.wav' returning id)
select pg_temp.assert_true((select count(*)=0 from changed),'granted reader cannot move original');
with removed as(delete from storage.objects where name=pg_temp.uid('hard-a') || '/audio/replacement.wav' returning id)
select pg_temp.assert_true((select count(*)=0 from removed),'granted reader cannot delete original');
-- Read + own-folder upload inherently permits a saved copy. It conveys no right
-- to alter original; this is why there is no misleading separate download flag.
insert into storage.objects(bucket_id,name) select 'artist-files',pg_temp.uid('hard-la') || '/audio/saved-copy.wav'
from storage.objects where name=pg_temp.uid('hard-a') || '/audio/replacement.wav';
select pg_temp.expect_error($q$insert into storage.objects(bucket_id,name) values('artist-files',pg_temp.uid('hard-b') || '/audio/copied.wav')$q$,'42501');

-- D: revocation immediately denies future SELECT/sign authorization, not old URLs.
select set_config('request.jwt.claim.sub',pg_temp.uid('hard-a')::text,true);
select public.revoke_asset_org_grant(pg_temp.uid('hard-track'),pg_temp.uid('hard-oa'));
select set_config('request.jwt.claim.sub',pg_temp.uid('hard-la')::text,true);
select pg_temp.assert_true(not asset_access.can_read_object(pg_temp.uid('hard-a') || '/audio/replacement.wav'),'revocation closes original');
select pg_temp.assert_true((select count(*)=0 from public.assets where id=pg_temp.uid('hard-track')),'revocation closes metadata');
select pg_temp.assert_true((select count(*)=0 from storage.objects where name like pg_temp.uid('hard-a') || '/%'),'revocation closes covers/list');

-- Explicit release workflow preserves moderation's read query and clean flag.
select set_config('request.jwt.claim.sub',pg_temp.uid('hard-a')::text,true);
insert into public.releases(id,owner_id,org_id,artist_id,title,cover_path)
values(pg_temp.uid('hard-release'),pg_temp.uid('hard-a'),pg_temp.uid('hard-oa'),pg_temp.uid('hard-aa'),'Release',pg_temp.uid('hard-a') || '/photo/release.png');
select pg_temp.expect_error($q$update public.assets set release_id=pg_temp.uid('hard-release') where id=pg_temp.uid('hard-track')$q$,'42501');
select public.attach_asset_to_release(pg_temp.uid('hard-track'),pg_temp.uid('hard-release'),true);
select pg_temp.assert_true((select release_id=pg_temp.uid('hard-release') and is_clean_version from public.assets where id=pg_temp.uid('hard-track')),'owner attachment persists clean version');
select set_config('request.jwt.claim.sub',pg_temp.uid('hard-la')::text,true);
select pg_temp.assert_true((select count(*)=1 from public.assets where release_id=pg_temp.uid('hard-release') and is_clean_version),'existing moderation query reads submitted clean version');
select pg_temp.assert_true(asset_access.can_read_object(pg_temp.uid('hard-a') || '/photo/release.png'),'registered release cover readable');
-- A label cannot substitute another photo via its broadly editable release row.
update public.releases set cover_path=pg_temp.uid('hard-a') || '/photo/neighbor.png' where id=pg_temp.uid('hard-release');
select pg_temp.assert_true(not asset_access.can_read_object(pg_temp.uid('hard-a') || '/photo/neighbor.png'),'release path spoofing does not grant access');
select pg_temp.expect_error($q$select public.attach_asset_to_release(pg_temp.uid('hard-track'),pg_temp.uid('hard-release'),false)$q$,'42501');
select set_config('request.jwt.claim.sub',pg_temp.uid('hard-lb')::text,true);
select pg_temp.assert_true(not asset_access.can_read_object(pg_temp.uid('hard-a') || '/photo/release.png'),'other label does not inherit release cover');
reset role;
select set_config('request.jwt.claim.sub','',true);

select pg_temp.expect_error($q$insert into public.asset_org_grants(asset_id,org_id,granted_by,permission)
values(pg_temp.uid('hard-track'),pg_temp.uid('hard-oa'),pg_temp.uid('hard-b'),'view')$q$,'42501');
select pg_temp.expect_error($q$insert into public.asset_org_grants(asset_id,org_id,granted_by,permission)
values(pg_temp.uid('hard-track'),pg_temp.uid('missing-org'),pg_temp.uid('hard-a'),'view')$q$,'23503');
select pg_temp.expect_error($q$insert into public.asset_org_grants(asset_id,org_id,granted_by,permission)
values(pg_temp.uid('hard-track'),pg_temp.uid('hard-oa'),pg_temp.uid('hard-a'),'view')$q$,'23505');

-- I: playback remains closed even if an unrelated permissive policy drifts.
insert into storage.objects(bucket_id,name) values('audio-playback','synthetic-playback.mp3');
create policy hard_test_drift on storage.objects for all to anon,authenticated using(true) with check(true);
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.uid('hard-la')::text,true);
select pg_temp.assert_true((select count(*)=0 from storage.objects where bucket_id='audio-playback'),'playback not inherited through grant');
select pg_temp.assert_true(not asset_access.can_read_object(pg_temp.uid('hard-a') || '/photo/neighbor.png'),'neighbor stays denied');
select pg_temp.assert_true((select count(*)=0 from storage.objects where name=pg_temp.uid('hard-a') || '/photo/neighbor.png'),'restrictive original boundary resists drift');
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.assert_true((select count(*)=0 from storage.objects where bucket_id in ('artist-files','audio-playback')),'anon denied both buckets');
select pg_temp.assert_true((select count(*)=0 from public.assets),'anon denied assets');
select pg_temp.expect_error('select * from public.asset_org_grants','42501');
select pg_temp.expect_error($q$select public.grant_asset_to_org(pg_temp.uid('hard-track'),pg_temp.uid('hard-oa'),'view')$q$,'42501');
reset role;
drop policy hard_test_drift on storage.objects;

-- F: owner deletes assets and objects; grants cascade, other files survive.
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.uid('hard-a')::text,true);
delete from storage.objects where name in (pg_temp.uid('hard-a') || '/audio/replacement.wav',pg_temp.uid('hard-a') || '/photo/replacement.png');
delete from public.assets where id=pg_temp.uid('hard-track');
select pg_temp.assert_true((select count(*)=0 from public.assets where id=pg_temp.uid('hard-track')),'owner delete works');
select pg_temp.assert_true((select count(*)=0 from public.asset_org_grants where asset_id=pg_temp.uid('hard-track')),'asset deletion removes grants');
select pg_temp.assert_true((select count(*)=1 from storage.objects where name=pg_temp.uid('hard-a') || '/photo/neighbor.png'),'neighbor unaffected');
select 'PASS A-J: SQL owner/grant/cover/UPDATE/revocation/release/playback isolation and demo workflows' as result;
rollback;
