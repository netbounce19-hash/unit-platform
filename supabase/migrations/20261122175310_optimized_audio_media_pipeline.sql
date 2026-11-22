-- Additive PR 2. Never starts a worker or processes uploads automatically.
begin;
alter table private_audio.audio_playback_variants
  add column output_profile_version text not null default 'legacy-pr1',
  add column output_sha256 text check (output_sha256 ~ '^[0-9a-f]{64}$'),
  add column cleanup_after timestamptz,
  drop constraint audio_playback_variants_asset_id_source_fingerprint_codec_key,
  add unique(asset_id, source_fingerprint, output_profile_version);
alter table private_audio.audio_playback_variants alter column output_profile_version set default 'mp3-192-v1';

create table private_audio.media_jobs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  variant_id uuid references private_audio.audio_playback_variants(id) on delete set null,
  -- Snapshot, not a content hash. source_fingerprint remains actual byte SHA256.
  source_path text not null,
  source_revision text not null,
  output_profile_version text not null default 'mp3-192-v1' check(output_profile_version='mp3-192-v1'),
  status text not null default 'pending' check(status in ('pending','processing','completed','failed','cancelled')),
  attempt_count int not null default 0 check(attempt_count between 0 and 3),
  max_attempts int not null default 3 check(max_attempts between 1 and 3),
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  worker_id uuid,
  fence uuid,
  last_error_code text check(last_error_code ~ '^[A-Z][A-Z0-9_]{0,63}$'),
  input_bytes bigint, output_bytes bigint, duration_ms bigint, processing_ms bigint,
  cpu_ms bigint, downloaded_bytes bigint, uploaded_bytes bigint,
  reused_variant boolean not null default false,
  request_count bigint not null default 1,
  cache_hit_count bigint not null default 0,
  strategy text check(strategy in ('transcode','stream_copy')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (status<>'completed' or (input_bytes is not null and input_bytes>0 and output_bytes is not null and output_bytes>0
    and duration_ms is not null and duration_ms>0 and processing_ms is not null and processing_ms>=0
    and cpu_ms is not null and cpu_ms>=0 and downloaded_bytes is not null and downloaded_bytes>=input_bytes
    and uploaded_bytes is not null and uploaded_bytes>=0)),
  check ((status='processing') = (locked_until is not null and worker_id is not null and fence is not null)),
  unique(asset_id, source_revision, output_profile_version)
);
create index media_jobs_claim_idx on private_audio.media_jobs(next_attempt_at,created_at)
  where status in ('pending','processing');
create index media_jobs_variant_idx on private_audio.media_jobs(variant_id);
alter table private_audio.media_jobs enable row level security;

-- Tombstones survive cascaded asset/variant deletion. Never delete a prefix.
-- Keep tombstones after a successful delete to catch late uploads from dead leases.
create table private_audio.media_cleanup (
  storage_path text primary key check(storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.mp3$'),
  asset_id uuid not null,
  not_before timestamptz not null default (now()+interval '15 minutes'),
  checked_at timestamptz,
  fence uuid,
  locked_until timestamptz,
  attempt_count int not null default 0
);
create index media_cleanup_due_idx on private_audio.media_cleanup(not_before);
alter table private_audio.media_cleanup enable row level security;
revoke all on private_audio.media_jobs,private_audio.media_cleanup from public,anon,authenticated,service_role,unit_audio_backend;

create function private_audio.source_revision(p_asset uuid) returns text
language sql stable security definer set search_path='' as $$
  select encode(pg_catalog.sha256(convert_to(jsonb_build_array(a.storage_path,o.id,to_jsonb(o)->'version',
    to_jsonb(o)->'updated_at',to_jsonb(o)->'metadata')::text,'UTF8')),'hex')
  from public.assets a join storage.objects o on o.bucket_id='artist-files' and o.name=a.storage_path
  where a.id=p_asset and a.kind='audio' and asset_access.owned_path(a.storage_path,a.owner_id,'audio');
$$;
create function private_audio.queue_cleanup() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into private_audio.media_cleanup(storage_path,asset_id) values(old.storage_path,old.asset_id)
    on conflict(storage_path) do update set not_before=greatest(private_audio.media_cleanup.not_before,now()+interval '15 minutes');
  return old;
end $$;
create trigger media_variant_delete before delete on private_audio.audio_playback_variants
  for each row execute function private_audio.queue_cleanup();

create function public.request_playback_variant(p_asset_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.assets; j private_audio.media_jobs; rev text;
begin
  -- Serialize only short queue admissions so concurrent assets cannot bypass
  -- per-owner/global backpressure. Workers never take this advisory lock.
  perform pg_catalog.pg_advisory_xact_lock(21414002);
  select * into a from public.assets where id=p_asset_id for update;
  if auth.uid() is null or a.owner_id is distinct from auth.uid() then
    raise exception 'Only owner can request playback' using errcode='42501'; end if;
  if a.kind<>'audio' then raise exception 'AUDIO_REQUIRED' using errcode='23514'; end if;
  rev:=private_audio.source_revision(a.id);
  if rev is null then raise exception 'SOURCE_MISSING' using errcode='23514'; end if;
  select * into j from private_audio.media_jobs where asset_id=a.id and source_revision=rev and output_profile_version='mp3-192-v1';
  if not found then
    if (select count(*) from private_audio.media_jobs q join public.assets x on x.id=q.asset_id
      where x.owner_id=a.owner_id and q.status in ('pending','processing'))>=4
      or (select count(*) from private_audio.media_jobs where status in ('pending','processing'))>=1000 then
      raise exception 'QUEUE_FULL' using errcode='53300'; end if;
    insert into private_audio.media_jobs(asset_id,source_path,source_revision)
      values(a.id,a.storage_path,rev) returning * into j;
  else
    update private_audio.media_jobs set request_count=request_count+1 where id=j.id;
    if j.status='completed' and not exists(select 1 from private_audio.audio_playback_variants v
      join storage.objects o on o.bucket_id='audio-playback' and o.name=v.storage_path where v.id=j.variant_id and v.status='ready') then
      update private_audio.media_jobs set status='pending',attempt_count=0,next_attempt_at=clock_timestamp(),
        completed_at=null,reused_variant=false where id=j.id returning * into j;
    elsif j.status='completed' then
      update private_audio.media_jobs set cache_hit_count=cache_hit_count+1 where id=j.id;
    end if;
  end if;
  return jsonb_build_object('job_id',j.id,'variant_id',j.variant_id,'status',j.status,'error_code',j.last_error_code);
end $$;

create function public.media_claim(p_worker uuid,p_max_attempts int default 3) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private_audio.media_jobs; a public.assets;
begin
  if p_worker is null then raise exception 'WORKER_REQUIRED'; end if;
  -- Expired third attempts are terminal, not a fourth retry.
  update private_audio.media_jobs set status='failed',last_error_code='LEASE_EXPIRED',
    locked_until=null,worker_id=null,fence=null,completed_at=clock_timestamp(),updated_at=clock_timestamp()
    where id in (select id from private_audio.media_jobs where
      ((status='processing' and locked_until<clock_timestamp()) or (status='pending' and next_attempt_at<=clock_timestamp()))
      and attempt_count>=least(max_attempts,greatest(p_max_attempts,1),3) limit 50 for update skip locked);
  insert into private_audio.media_cleanup(storage_path,asset_id)
    select v.storage_path,v.asset_id from private_audio.audio_playback_variants v
    where v.status<>'ready' and exists(select 1 from private_audio.media_jobs mq where mq.variant_id=v.id and mq.status in ('failed','cancelled'))
      and not exists(select 1 from private_audio.media_jobs mq where mq.variant_id=v.id and mq.status in ('pending','processing'))
    on conflict do nothing;
  select * into j from private_audio.media_jobs
    where attempt_count<least(max_attempts,greatest(p_max_attempts,1),3) and ((status='pending' and next_attempt_at<=clock_timestamp())
      or (status='processing' and locked_until<clock_timestamp()))
    order by next_attempt_at,created_at limit 1 for update skip locked;
  if not found then return null; end if;
  select * into a from public.assets where id=j.asset_id;
  if private_audio.source_revision(j.asset_id) is distinct from j.source_revision then
    update private_audio.media_jobs set status='cancelled',last_error_code='SOURCE_CHANGED',locked_until=null,
      worker_id=null,fence=null,completed_at=clock_timestamp() where id=j.id;
    return null;
  end if;
  update private_audio.media_jobs set status='processing',attempt_count=attempt_count+1,
    max_attempts=least(max_attempts,greatest(p_max_attempts,1),3),
    fence=gen_random_uuid(),worker_id=p_worker,locked_until=clock_timestamp()+interval '90 seconds',
    updated_at=clock_timestamp() where id=j.id returning * into j;
  return to_jsonb(j)||jsonb_build_object('owner_id',a.owner_id);
end $$;

-- All worker transitions validate the fencing token AND unexpired lease.
create function private_audio.lock_job(p_job uuid,p_fence uuid) returns private_audio.media_jobs
language plpgsql security definer set search_path='' as $$
declare j private_audio.media_jobs;
begin
  select * into j from private_audio.media_jobs where id=p_job for update;
  if not found or j.status<>'processing' or j.fence is distinct from p_fence or j.locked_until<=clock_timestamp() then
    raise exception 'LEASE_LOST' using errcode='55000'; end if;
  perform 1 from public.assets where id=j.asset_id for share;
  perform 1 from storage.objects where bucket_id='artist-files' and name=j.source_path for share;
  if private_audio.source_revision(j.asset_id) is distinct from j.source_revision then
    raise exception 'SOURCE_CHANGED' using errcode='55000'; end if;
  return j;
end $$;
create function public.media_heartbeat(p_job uuid,p_fence uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  perform private_audio.lock_job(p_job,p_fence);
  update private_audio.media_jobs set locked_until=clock_timestamp()+interval '90 seconds',updated_at=clock_timestamp() where id=p_job;
  return true;
end $$;

create function public.media_resolve(p_job uuid,p_fence uuid,p_sha256 text,p_input_bytes bigint,p_elapsed_ms bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j private_audio.media_jobs; a public.assets; v private_audio.audio_playback_variants; vid uuid:=gen_random_uuid();
begin
  j:=private_audio.lock_job(p_job,p_fence);
  select * into a from public.assets where id=j.asset_id for share;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' or p_input_bytes not between 1 and 250000000 then raise exception 'INVALID_FINGERPRINT'; end if;
  insert into private_audio.audio_playback_variants(id,asset_id,source_fingerprint,storage_path,output_profile_version)
    values(vid,a.id,p_sha256,a.owner_id||'/'||a.id||'/'||vid||'.mp3',j.output_profile_version)
    on conflict(asset_id,source_fingerprint,output_profile_version) do nothing;
  select * into v from private_audio.audio_playback_variants where asset_id=a.id
    and source_fingerprint=p_sha256 and output_profile_version=j.output_profile_version for update;
  -- Different source revisions with identical bytes may reach the same variant.
  if v.status<>'ready' and exists(select 1 from private_audio.media_jobs q where q.id<>j.id
    and q.variant_id=v.id and q.status='processing' and q.locked_until>clock_timestamp()) then
    raise exception 'VARIANT_BUSY' using errcode='55P03'; end if;
  if v.status='ready' and v.cleanup_after is not null then
    -- Re-selecting an old source may reuse a not-yet-deleted ready copy. The
    -- cleanup transaction deletes metadata before it can delete physical bytes.
    delete from private_audio.media_cleanup where storage_path=v.storage_path and locked_until is null;
    if exists(select 1 from private_audio.media_cleanup where storage_path=v.storage_path) then
      raise exception 'VARIANT_RETIRED' using errcode='55000'; end if;
    update private_audio.audio_playback_variants set cleanup_after=null where id=v.id;
  end if;
  if v.status='ready' and (v.output_sha256 is null or v.bitrate_kbps<>192) then
    raise exception 'UNQUALIFIED_VARIANT' using errcode='55000'; end if;
  if (v.status='failed' and exists(select 1 from private_audio.media_cleanup where storage_path=v.storage_path))
    or (v.status='ready' and not exists(select 1 from storage.objects where bucket_id='audio-playback' and name=v.storage_path)) then
    -- Never recycle the path of a terminal failure or deleted copy.
    delete from private_audio.audio_playback_variants where id=v.id;
    vid:=gen_random_uuid();
    insert into private_audio.audio_playback_variants(id,asset_id,source_fingerprint,storage_path,output_profile_version)
      values(vid,a.id,p_sha256,a.owner_id||'/'||a.id||'/'||vid||'.mp3',j.output_profile_version) returning * into v;
  end if;
  update private_audio.media_jobs set variant_id=v.id where id=j.id;
  if v.status='ready' then
    update private_audio.media_jobs set status='completed',last_error_code=null,reused_variant=true,completed_at=clock_timestamp(),
      input_bytes=p_input_bytes,downloaded_bytes=coalesce(downloaded_bytes,0)+p_input_bytes,output_bytes=v.size_bytes,duration_ms=v.duration_ms,
      processing_ms=coalesce(processing_ms,0)+p_elapsed_ms,cpu_ms=coalesce(cpu_ms,0),uploaded_bytes=coalesce(uploaded_bytes,0),
      locked_until=null,worker_id=null,fence=null where id=j.id;
  else
    update private_audio.audio_playback_variants set status='processing',error_code=null where id=v.id;
  end if;
  return jsonb_build_object('variant_id',v.id,'storage_path',v.storage_path,'reused',v.status='ready');
end $$;

create function public.media_complete(p_job uuid,p_fence uuid,p_metrics jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare j private_audio.media_jobs; v private_audio.audio_playback_variants;
begin
  j:=private_audio.lock_job(p_job,p_fence);
  select * into v from private_audio.audio_playback_variants where id=j.variant_id for update;
  if not found or not exists(select 1 from storage.objects where bucket_id='audio-playback' and name=v.storage_path) then
    raise exception 'OUTPUT_MISSING' using errcode='23514'; end if;
  if not (p_metrics ?& array['output_sha256','input_bytes','duration_ms','output_bytes','processing_ms','cpu_ms','downloaded_bytes','uploaded_bytes','strategy'])
    or p_metrics->>'output_sha256' is null or (p_metrics->>'output_sha256') !~ '^[0-9a-f]{64}$' or (p_metrics->>'input_bytes')::bigint not between 1 and 250000000
    or (p_metrics->>'duration_ms')::bigint not between 1 and 1800000
    or (p_metrics->>'output_bytes')::bigint not between 1 and 50000000 then raise exception 'INVALID_METRICS'; end if;
  update private_audio.audio_playback_variants set status='ready',error_code=null,
    bitrate_kbps=192,duration_ms=(p_metrics->>'duration_ms')::bigint,
    size_bytes=(p_metrics->>'output_bytes')::bigint,output_sha256=p_metrics->>'output_sha256' where id=v.id;
  update private_audio.media_jobs set status='completed',last_error_code=null,locked_until=null,worker_id=null,fence=null,
    input_bytes=(p_metrics->>'input_bytes')::bigint,output_bytes=(p_metrics->>'output_bytes')::bigint,
    duration_ms=(p_metrics->>'duration_ms')::bigint,processing_ms=coalesce(processing_ms,0)+(p_metrics->>'processing_ms')::bigint,
    cpu_ms=coalesce(cpu_ms,0)+(p_metrics->>'cpu_ms')::bigint,downloaded_bytes=coalesce(downloaded_bytes,0)+(p_metrics->>'downloaded_bytes')::bigint,
    uploaded_bytes=coalesce(uploaded_bytes,0)+(p_metrics->>'uploaded_bytes')::bigint,strategy=p_metrics->>'strategy',
    completed_at=clock_timestamp(),updated_at=clock_timestamp() where id=j.id;
  -- Retire only older ready versions AFTER successful new publication.
  update private_audio.audio_playback_variants set cleanup_after=clock_timestamp()+interval '15 minutes'
    where asset_id=j.asset_id and id<>v.id and status='ready' and cleanup_after is null;
  insert into private_audio.media_cleanup(storage_path,asset_id,not_before)
    select storage_path,asset_id,cleanup_after from private_audio.audio_playback_variants
    where asset_id=j.asset_id and cleanup_after is not null on conflict do nothing;
  return true;
end $$;

create function public.media_fail(p_job uuid,p_fence uuid,p_code text,p_retry boolean,p_max_attempts int default 3,p_metrics jsonb default '{}') returns boolean
language plpgsql security definer set search_path='' as $$
declare j private_audio.media_jobs; again boolean;
begin
  -- Do not require source_revision to match on failure: cancellation must persist.
  select * into j from private_audio.media_jobs where id=p_job for update;
  if not found or j.status<>'processing' or j.fence is distinct from p_fence or j.locked_until<=clock_timestamp() then return false; end if;
  if p_code is null or p_code !~ '^[A-Z][A-Z0-9_]{0,63}$' then raise exception 'INVALID_ERROR_CODE'; end if;
  again:=p_retry and j.attempt_count<least(j.max_attempts,greatest(p_max_attempts,1),3);
  update private_audio.media_jobs set status=case when p_code='SOURCE_CHANGED' then 'cancelled' when again then 'pending' else 'failed' end,
    last_error_code=p_code,next_attempt_at=clock_timestamp()+make_interval(secs=>30*power(2,j.attempt_count-1)::int+floor(random()*11)::int),
    locked_until=null,worker_id=null,fence=null,updated_at=clock_timestamp(),
    processing_ms=coalesce(processing_ms,0)+greatest(coalesce((p_metrics->>'processing_ms')::bigint,0),0),
    cpu_ms=coalesce(cpu_ms,0)+greatest(coalesce((p_metrics->>'cpu_ms')::bigint,0),0),
    downloaded_bytes=coalesce(downloaded_bytes,0)+greatest(coalesce((p_metrics->>'downloaded_bytes')::bigint,0),0),
    uploaded_bytes=coalesce(uploaded_bytes,0)+greatest(coalesce((p_metrics->>'uploaded_bytes')::bigint,0),0),
    completed_at=case when again then null else clock_timestamp() end where id=j.id;
  if not again and j.variant_id is not null then
    update private_audio.audio_playback_variants set status='failed',error_code=p_code
      where id=j.variant_id and status<>'ready';
    insert into private_audio.media_cleanup(storage_path,asset_id)
      select storage_path,asset_id from private_audio.audio_playback_variants where id=j.variant_id and status<>'ready'
      on conflict do nothing;
  end if;
  return true;
end $$;

create function public.media_cleanup_claim() returns jsonb
language plpgsql security definer set search_path='' as $$
declare c private_audio.media_cleanup;
begin
  select * into c from private_audio.media_cleanup candidate where candidate.not_before<=clock_timestamp()
    and (candidate.locked_until is null or candidate.locked_until<clock_timestamp())
    and not exists(select 1 from private_audio.media_jobs j where j.asset_id=candidate.asset_id and j.status='processing' and j.locked_until>clock_timestamp())
    and not exists(select 1 from private_audio.audio_playback_variants v where v.storage_path=candidate.storage_path and v.status='ready' and v.cleanup_after is null)
    and not exists(select 1 from private_audio.audio_share_links l where l.asset_id=candidate.asset_id and l.revoked_at is null and (l.expires_at is null or l.expires_at>clock_timestamp()))
    and not exists(select 1 from private_audio.audio_playback_sessions s join private_audio.audio_share_links l on l.id=s.share_link_id
      where l.asset_id=candidate.asset_id and s.revoked_at is null and s.expires_at>clock_timestamp())
    order by candidate.not_before limit 1 for update skip locked;
  if not found then return null; end if;
  -- Remove retired metadata before issuing the physical-delete capability.
  -- A subsequent request for these bytes gets a NEW UUID/path, never this one.
  delete from private_audio.audio_playback_variants v where v.storage_path=c.storage_path
    and (v.cleanup_after is not null or v.status<>'ready');
  update private_audio.media_cleanup set fence=gen_random_uuid(),locked_until=clock_timestamp()+interval '90 seconds',
    attempt_count=attempt_count+1 where storage_path=c.storage_path returning * into c;
  return jsonb_build_object('storage_path',c.storage_path,'fence',c.fence);
end $$;
create function public.media_cleanup_done(p_path text,p_fence uuid,p_success boolean) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  update private_audio.media_cleanup set checked_at=clock_timestamp(),fence=null,locked_until=null,
    not_before=clock_timestamp()+case when p_success then interval '24 hours' else interval '1 hour' end
    where storage_path=p_path and fence=p_fence and locked_until>clock_timestamp();
  return found;
end $$;

-- Helpers remain private. Public worker RPCs are service-role-only for the
-- disposable development runtime; NOLOGIN unit_audio_backend is not a JWT.
revoke all on function private_audio.source_revision(uuid),private_audio.queue_cleanup(),private_audio.lock_job(uuid,uuid)
  from public,anon,authenticated,service_role,unit_audio_backend;
revoke all on function public.request_playback_variant(uuid) from public,anon,service_role;
grant execute on function public.request_playback_variant(uuid) to authenticated;
revoke all on function public.media_claim(uuid,int),public.media_heartbeat(uuid,uuid),public.media_resolve(uuid,uuid,text,bigint,bigint),
  public.media_complete(uuid,uuid,jsonb),public.media_fail(uuid,uuid,text,boolean,int,jsonb),public.media_cleanup_claim(),public.media_cleanup_done(text,uuid,boolean)
  from public,anon,authenticated;
grant execute on function public.media_claim(uuid,int),public.media_heartbeat(uuid,uuid),public.media_resolve(uuid,uuid,text,bigint,bigint),
  public.media_complete(uuid,uuid,jsonb),public.media_fail(uuid,uuid,text,boolean,int,jsonb),public.media_cleanup_claim(),public.media_cleanup_done(text,uuid,boolean)
  to service_role;
commit;
