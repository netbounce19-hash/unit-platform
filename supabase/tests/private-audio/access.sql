-- Run after historical migrations + new migration on a DISPOSABLE database only.
-- Synthetic users; all test changes rolled back. Native Supabase: bootstrap is NOT needed.
begin;
create function pg_temp.assert_true(value boolean, label text) returns void language plpgsql as $$
begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
end $$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected then return; end if;
    raise exception 'Expected SQLSTATE %, got %: %', expected, sqlstate, sqlerrm;
  end;
  raise exception 'Expected SQLSTATE %, statement succeeded: %', expected, statement;
end $$;

-- Helper fixture IDs: same inputs always produce the same UUID; no real users.
create function pg_temp.uid(label text) returns uuid language sql immutable as $$ select md5(label)::uuid $$;
insert into auth.users(id,email) select pg_temp.uid(n),n || '@example.invalid' from unnest(array['artist-a','artist-b','label-a','label-b']) n;
insert into public.organizations(id,name) values (pg_temp.uid('org-a'),'Label A'),(pg_temp.uid('org-b'),'Label B');
insert into public.memberships(org_id,user_id,role) values
  (pg_temp.uid('org-a'),pg_temp.uid('label-a'),'label_admin'),
  (pg_temp.uid('org-b'),pg_temp.uid('label-b'),'label_admin');
-- One artist account deliberately linked to TWO different organizations.
insert into public.artists(id,org_id,user_id,stage_name) values
  (pg_temp.uid('artist-org-a'),pg_temp.uid('org-a'),pg_temp.uid('artist-a'),'Artist A'),
  (pg_temp.uid('artist-org-b'),pg_temp.uid('org-b'),pg_temp.uid('artist-a'),'Artist A');
insert into public.assets(id,owner_id,kind,title,storage_path,org_id) values
  (pg_temp.uid('audio'),pg_temp.uid('artist-a'),'audio','Private unreleased',pg_temp.uid('artist-a') || '/audio/unreleased.wav',null),
  (pg_temp.uid('photo'),pg_temp.uid('artist-a'),'photo','Cover',pg_temp.uid('artist-a') || '/photo/cover.png',null),
  (pg_temp.uid('document'),pg_temp.uid('artist-a'),'document','Contract',pg_temp.uid('artist-a') || '/document/contract.pdf',null),
  (pg_temp.uid('org-audio'),pg_temp.uid('artist-a'),'audio','Org audio',pg_temp.uid('artist-a') || '/audio/org.wav',pg_temp.uid('org-a'));
insert into storage.objects(bucket_id,name) values ('artist-files',pg_temp.uid('artist-a') || '/audio/unreleased.wav');

select pg_temp.assert_true((select track_type='demo' and visibility='private' and download_enabled=false from public.assets where id=pg_temp.uid('audio')), 'legacy-compatible private defaults');
select pg_temp.assert_true((select not public from storage.buckets where id='audio-playback'), 'bucket private');
select pg_temp.assert_true((select count(*)=4 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private_audio' and c.relkind='r' and c.relrowsecurity), 'all four tables have RLS');
select pg_temp.assert_true(not pg_has_role('authenticated','unit_audio_backend','MEMBER') and not pg_has_role('anon','unit_audio_backend','MEMBER'), 'no client role escalation');

-- DB owner seeds server-only rows; creator must be actual asset owner.
insert into private_audio.audio_share_links(id,asset_id,created_by,token_hash)
values (pg_temp.uid('link'),pg_temp.uid('audio'),pg_temp.uid('artist-a'),repeat('a',64));
insert into private_audio.audio_share_links(id,asset_id,created_by,token_hash,access_mode,pin_hash)
values (pg_temp.uid('pin-link'),pg_temp.uid('audio'),pg_temp.uid('artist-a'),repeat('b',64),'pin','$argon2id$v=19$m=65536,t=3,p=1$fixtureSalt$fixtureDigest');
select pg_temp.expect_error($q$insert into private_audio.audio_share_links(asset_id,created_by,token_hash) values(pg_temp.uid('missing'),pg_temp.uid('artist-a'),repeat('c',64))$q$,'23503');
select pg_temp.expect_error($q$insert into private_audio.audio_share_links(asset_id,created_by,token_hash) values(pg_temp.uid('photo'),pg_temp.uid('artist-a'),repeat('c',64))$q$,'23514');
select pg_temp.expect_error($q$insert into private_audio.audio_share_links(asset_id,created_by,token_hash) values(pg_temp.uid('document'),pg_temp.uid('artist-a'),repeat('c',64))$q$,'23514');
select pg_temp.expect_error($q$insert into private_audio.audio_share_links(asset_id,created_by,token_hash,access_mode) values(pg_temp.uid('audio'),pg_temp.uid('artist-a'),repeat('c',64),'pin')$q$,'23514');
select pg_temp.expect_error($q$insert into private_audio.audio_share_links(asset_id,created_by,token_hash,pin_hash) values(pg_temp.uid('audio'),pg_temp.uid('artist-a'),repeat('c',64),'$argon2id$v=19$m=65536,t=3,p=1$salt$digest')$q$,'23514');
select pg_temp.expect_error($q$insert into private_audio.audio_share_links(asset_id,created_by,token_hash) values(pg_temp.uid('audio'),pg_temp.uid('label-a'),repeat('c',64))$q$,'23514');
select pg_temp.expect_error($q$insert into private_audio.audio_share_links(asset_id,created_by,token_hash) values(pg_temp.uid('audio'),pg_temp.uid('artist-a'),'raw-token')$q$,'23514');
select pg_temp.expect_error($q$insert into private_audio.audio_share_links(asset_id,created_by,token_hash,access_mode,pin_hash) values(pg_temp.uid('audio'),pg_temp.uid('artist-a'),repeat('c',64),'pin','1234')$q$,'23514');
select pg_temp.expect_error($q$insert into private_audio.audio_share_links(asset_id,created_by,token_hash) values(pg_temp.uid('audio'),pg_temp.uid('artist-a'),repeat('a',64))$q$,'23505');

insert into private_audio.audio_playback_variants(id,asset_id,storage_path,source_fingerprint)
values (pg_temp.uid('variant'),pg_temp.uid('audio'),pg_temp.uid('artist-a') || '/' || pg_temp.uid('audio') || '/' || pg_temp.uid('variant') || '.mp3',repeat('c',64));
select pg_temp.expect_error($q$update private_audio.audio_playback_variants set status='ready' where id=pg_temp.uid('variant')$q$,'23514');
select pg_temp.expect_error($q$update private_audio.audio_playback_variants set storage_path='wrong/path.mp3' where id=pg_temp.uid('variant')$q$,'23514');
select pg_temp.expect_error($q$update public.assets set kind='photo' where id=pg_temp.uid('audio')$q$,'23514');
select pg_temp.expect_error($q$update public.assets set owner_id=pg_temp.uid('artist-b') where id=pg_temp.uid('audio')$q$,'23514');

insert into private_audio.audio_playback_sessions(id,share_link_id,session_secret_hash)
values (pg_temp.uid('session'),pg_temp.uid('link'),repeat('d',64));
select pg_temp.assert_true((select expires_at-authorized_at=interval '30 minutes' from private_audio.audio_playback_sessions where id=pg_temp.uid('session')), 'session default TTL');
select pg_temp.expect_error($q$update private_audio.audio_playback_sessions set expires_at=expires_at+interval '1 minute' where id=pg_temp.uid('session')$q$,'23514');
insert into private_audio.audio_play_events(share_link_id,session_id,event_type,event_nonce)
values (pg_temp.uid('link'),pg_temp.uid('session'),'qualified_play',pg_temp.uid('nonce'));
select pg_temp.expect_error($q$insert into private_audio.audio_play_events(share_link_id,session_id,event_type,event_nonce) values(pg_temp.uid('link'),pg_temp.uid('session'),'qualified_play',pg_temp.uid('nonce-2'))$q$,'23505');
select pg_temp.expect_error($q$insert into private_audio.audio_play_events(share_link_id,session_id,event_type,event_nonce) values(pg_temp.uid('link'),pg_temp.uid('session'),'play_start',pg_temp.uid('nonce'))$q$,'23505');
select pg_temp.expect_error($q$insert into private_audio.audio_play_events(share_link_id,session_id,event_type,event_nonce) values(pg_temp.uid('pin-link'),pg_temp.uid('session'),'play_start',pg_temp.uid('nonce-3'))$q$,'23503');
select pg_temp.expect_error($q$insert into private_audio.audio_play_events(share_link_id,event_type,event_nonce) values(pg_temp.uid('link'),'qualified_play',pg_temp.uid('nonce-4'))$q$,'23514');

-- Create objects as db owner, then test RLS even in presence of an overly broad permissive policy.
insert into storage.objects(bucket_id,name) select 'audio-playback',storage_path from private_audio.audio_playback_variants;
create policy audio_test_permissive on storage.objects for all to anon, authenticated using(true) with check(true);
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.uid('artist-a')::text,true);
select pg_temp.assert_true((select count(*)=1 from public.assets where id=pg_temp.uid('audio')), 'Artist A can read own metadata');
select pg_temp.assert_true((select count(*)=2 from public.audio_share_link_metadata), 'owner sees independent links without hashes');
select pg_temp.expect_error('select token_hash from public.audio_share_link_metadata','42703');
select pg_temp.expect_error('select pin_hash from public.audio_share_link_metadata','42703');
select pg_temp.expect_error('select storage_path from public.audio_share_link_metadata','42703');
select pg_temp.expect_error('select * from private_audio.audio_share_links','42501');
select pg_temp.expect_error('select * from private_audio.audio_playback_sessions','42501');
select pg_temp.expect_error('select * from private_audio.audio_playback_variants','42501');
select pg_temp.expect_error('select * from private_audio.audio_play_events','42501');
select pg_temp.expect_error($q$insert into private_audio.audio_share_links(asset_id,created_by,token_hash) values(pg_temp.uid('audio'),pg_temp.uid('artist-a'),repeat('f',64))$q$,'42501');
select pg_temp.assert_true((select count(*)=0 from storage.objects where bucket_id='audio-playback'), 'authenticated cannot read playback');
select pg_temp.expect_error($q$insert into storage.objects(bucket_id,name) values('audio-playback','forbidden.mp3')$q$,'42501');
with removed as (delete from storage.objects where bucket_id='audio-playback' returning id)
select pg_temp.assert_true((select count(*)=0 from removed),'client cannot delete playback');
with changed as (update storage.objects set name='forbidden.mp3' where bucket_id='audio-playback' returning id)
select pg_temp.assert_true((select count(*)=0 from changed),'client cannot update playback');
select set_config('request.jwt.claim.sub',pg_temp.uid('artist-b')::text,true);
select pg_temp.assert_true((select count(*)=0 from public.assets where id=pg_temp.uid('audio')), 'Artist B cannot see Artist A');
select pg_temp.assert_true((select count(*)=0 from public.audio_share_link_metadata), 'Artist B cannot see links');
select set_config('request.jwt.claim.sub',pg_temp.uid('label-a')::text,true);
select pg_temp.assert_true((select count(*)=0 from public.audio_share_link_metadata), 'Label A cannot see links');
select pg_temp.expect_error($q$update public.assets set visibility='public' where id=pg_temp.uid('org-audio')$q$,'42501');
select set_config('request.jwt.claim.sub',pg_temp.uid('label-b')::text,true);
select pg_temp.assert_true((select count(*)=0 from public.audio_share_link_metadata), 'Label B cannot see links');
reset role;
drop policy audio_test_permissive on storage.objects;

-- Known security finding: these assert the EXISTING exposure, not a desired guarantee.
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.uid('label-a')::text,true);
select pg_temp.assert_true(public.can_access_user_folder(pg_temp.uid('artist-a')::text), 'KNOWN RISK: Label A can access artist folder');
select pg_temp.assert_true((select count(*)=1 from storage.objects where name=pg_temp.uid('artist-a') || '/audio/unreleased.wav'), 'KNOWN RISK: Label A sees private original');
select set_config('request.jwt.claim.sub',pg_temp.uid('label-b')::text,true);
select pg_temp.assert_true((select count(*)=1 from public.assets where id=pg_temp.uid('audio')), 'KNOWN RISK: Label B sees private asset');
select pg_temp.assert_true((select count(*)=1 from storage.objects where name=pg_temp.uid('artist-a') || '/audio/unreleased.wav'), 'KNOWN RISK: Label B sees private original');
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.expect_error('select * from public.audio_share_link_metadata','42501');
select pg_temp.expect_error('select * from private_audio.audio_share_links','42501');
select pg_temp.expect_error('select * from private_audio.audio_playback_sessions','42501');
select pg_temp.expect_error('select * from private_audio.audio_playback_variants','42501');
select pg_temp.expect_error('select * from private_audio.audio_play_events','42501');
select pg_temp.expect_error($q$insert into private_audio.audio_play_events(share_link_id,event_type,event_nonce) values(pg_temp.uid('link'),'page_open',pg_temp.uid('anon-nonce'))$q$,'42501');
select pg_temp.assert_true((select count(*)=0 from storage.objects where bucket_id='audio-playback'),'anon cannot read playback');
reset role;

set local role service_role;
select pg_temp.expect_error('select * from private_audio.audio_share_links','42501');
reset role;

-- Restricted server role has no authority on originals or unknown object paths.
set local role unit_audio_backend;
select pg_temp.assert_true((select count(*)=1 from storage.objects where bucket_id='audio-playback'),'backend reads registered object');
delete from storage.objects where bucket_id='audio-playback';
insert into storage.objects(bucket_id,name) select 'audio-playback',storage_path from private_audio.audio_playback_variants;
select pg_temp.assert_true((select count(*)=1 from storage.objects where bucket_id='audio-playback'),'backend writes registered object');
select pg_temp.expect_error('delete from private_audio.audio_play_events','42501');
select pg_temp.assert_true((select count(*)=0 from storage.objects where bucket_id='artist-files'),'backend does not read originals');
select pg_temp.expect_error($q$insert into storage.objects(bucket_id,name) values('audio-playback','unregistered.mp3')$q$,'42501');
select pg_temp.expect_error($q$insert into storage.objects(bucket_id,name) values('artist-files','forbidden.mp3')$q$,'42501');
reset role;

-- Token rotation, PIN rotation, and revocation invalidate all outstanding sessions.
update private_audio.audio_share_links set token_hash=repeat('e',64) where id=pg_temp.uid('link');
select pg_temp.assert_true((select revoked_at is not null from private_audio.audio_playback_sessions where id=pg_temp.uid('session')), 'rotation revokes session');
select pg_temp.expect_error($q$update private_audio.audio_playback_sessions set revoked_at=null where id=pg_temp.uid('session')$q$,'23514');
insert into private_audio.audio_playback_sessions(id,share_link_id,session_secret_hash) values(pg_temp.uid('pin-session'),pg_temp.uid('pin-link'),repeat('1',64));
update private_audio.audio_share_links set pin_hash='$argon2id$v=19$m=65536,t=3,p=1$newSalt$newDigest' where id=pg_temp.uid('pin-link');
select pg_temp.assert_true((select revoked_at is not null from private_audio.audio_playback_sessions where id=pg_temp.uid('pin-session')), 'PIN change revokes session');
insert into private_audio.audio_playback_sessions(id,share_link_id,session_secret_hash) values(pg_temp.uid('revoke-session'),pg_temp.uid('link'),repeat('2',64));
update private_audio.audio_share_links set revoked_at=now() where id=pg_temp.uid('link');
select pg_temp.assert_true((select revoked_at is not null from private_audio.audio_playback_sessions where id=pg_temp.uid('revoke-session')), 'link revocation revokes session');
select pg_temp.expect_error($q$insert into private_audio.audio_playback_sessions(share_link_id,session_secret_hash) values(pg_temp.uid('link'),repeat('3',64))$q$,'23514');
update private_audio.audio_share_links set expires_at=now()+interval '5 minutes' where id=pg_temp.uid('pin-link');
insert into private_audio.audio_playback_sessions(id,share_link_id,session_secret_hash) values(pg_temp.uid('capped-session'),pg_temp.uid('pin-link'),repeat('4',64));
select pg_temp.assert_true((select expires_at=now()+interval '5 minutes' from private_audio.audio_playback_sessions where id=pg_temp.uid('capped-session')), 'session capped at link expiration');

delete from public.assets where id=pg_temp.uid('audio');
select pg_temp.assert_true((select count(*)=0 from private_audio.audio_share_links),'delete cascades links');
select pg_temp.assert_true((select count(*)=0 from private_audio.audio_playback_sessions),'delete cascades sessions');
select pg_temp.assert_true((select count(*)=0 from private_audio.audio_play_events),'delete cascades events');
select pg_temp.assert_true((select count(*)=0 from private_audio.audio_playback_variants),'delete cascades variants');
select 'PASS: access matrix, constraints, TTL, revocation, replay protection, cascades; legacy exposure reproduced' as result;
rollback;
