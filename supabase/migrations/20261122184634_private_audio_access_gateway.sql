-- PR 3. Development only: no credential provisioning, deployment or bucket change.
begin;
create role unit_audio_gateway nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant usage on schema public to unit_audio_gateway;
alter table private_audio.audio_share_links add column authorization_epoch uuid not null default gen_random_uuid();
alter table private_audio.audio_playback_sessions
  add column variant_id uuid references private_audio.audio_playback_variants(id) on delete cascade,
  add column source_revision text,
  add column authorization_epoch uuid;
create index audio_sessions_variant_idx on private_audio.audio_playback_sessions(variant_id);

create function private_audio.advance_link_epoch() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.token_hash is distinct from old.token_hash or new.pin_hash is distinct from old.pin_hash
    or new.access_mode is distinct from old.access_mode or new.expires_at is distinct from old.expires_at
    or new.revoked_at is distinct from old.revoked_at then new.authorization_epoch:=gen_random_uuid();
  else new.authorization_epoch:=old.authorization_epoch; end if;
  return new;
end $$;
create trigger audio_links_epoch before update on private_audio.audio_share_links
  for each row execute function private_audio.advance_link_epoch();
create function private_audio.guard_session_binding() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.variant_id is distinct from old.variant_id or new.source_revision is distinct from old.source_revision
    or new.authorization_epoch is distinct from old.authorization_epoch then
    raise exception 'Session binding is immutable' using errcode='23514'; end if;
  return new;
end $$;
create trigger audio_sessions_binding before update on private_audio.audio_playback_sessions
  for each row execute function private_audio.guard_session_binding();

create table private_audio.audio_rate_limits (
  key_hash text primary key check(key_hash ~ '^[0-9a-f]{64}$'),
  used integer not null check(used>0), expires_at timestamptz not null
);
create index audio_rate_limits_expiry on private_audio.audio_rate_limits(expires_at);
create table private_audio.audio_crypto_leases (
  id uuid primary key default gen_random_uuid(), expires_at timestamptz not null
);
create index audio_crypto_leases_expiry on private_audio.audio_crypto_leases(expires_at);
alter table private_audio.audio_rate_limits enable row level security;
alter table private_audio.audio_crypto_leases enable row level security;
revoke all on private_audio.audio_rate_limits,private_audio.audio_crypto_leases from public,anon,authenticated,service_role,unit_audio_backend,unit_audio_gateway;

create function private_audio.rate_key(p_value text) returns text
language sql immutable set search_path='' as $$ select encode(sha256(convert_to(p_value,'UTF8')),'hex') $$;
create function private_audio.take_rate(p_key text,p_limit int,p_seconds int) returns int
language plpgsql security definer set search_path='' as $$
declare b private_audio.audio_rate_limits;
begin
  insert into private_audio.audio_rate_limits(key_hash,used,expires_at)
    values(private_audio.rate_key(p_key),1,clock_timestamp()+make_interval(secs=>p_seconds))
    on conflict(key_hash) do update set
      used=case when private_audio.audio_rate_limits.expires_at<=clock_timestamp() then 1
        else least(private_audio.audio_rate_limits.used+1,p_limit+1) end,
      expires_at=case when private_audio.audio_rate_limits.expires_at<=clock_timestamp()
        then clock_timestamp()+make_interval(secs=>p_seconds) else private_audio.audio_rate_limits.expires_at end
    returning * into b;
  return case when b.used>p_limit then greatest(1,ceil(extract(epoch from b.expires_at-clock_timestamp()))::int) else 0 end;
end $$;
create function private_audio.gateway_limit(p_kind text,p_subject text,p_client text,p_ip text) returns int
language plpgsql security definer set search_path='' as $$
declare delay int;
begin
  if p_client !~ '^[0-9a-f]{64}$' or p_ip !~ '^[0-9a-f]{64}$' or p_subject is null then return 60; end if;
  delay:=private_audio.take_rate('global-minute',1000,60);
  if delay>0 then return delay; end if;
  delay:=private_audio.take_rate('global-day',100000,86400);
  if delay>0 then return delay; end if;
  delay:=private_audio.take_rate(p_kind||':ip:'||p_ip,case when p_kind='stream' then 300 else 120 end,60);
  if delay>0 then return delay; end if;
  delay:=private_audio.take_rate(p_kind||':subject-client:'||p_subject||':'||p_client,
    case when p_kind='stream' then 120 else 30 end,60);
  -- Bound TTL work; the global budgets bound new keys even under cookie churn.
  delete from private_audio.audio_rate_limits where key_hash in
    (select key_hash from private_audio.audio_rate_limits where expires_at<clock_timestamp()-interval '1 day' limit 64);
  return delay;
end $$;
create function private_audio.claim_crypto() returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  perform pg_advisory_xact_lock(21414003);
  delete from private_audio.audio_crypto_leases where expires_at<=clock_timestamp();
  if (select count(*) from private_audio.audio_crypto_leases)>=2 then return null; end if;
  if private_audio.take_rate('crypto-day',10000,86400)>0 then return null; end if;
  insert into private_audio.audio_crypto_leases(expires_at) values(clock_timestamp()+interval '60 seconds') returning id into result;
  return result;
end $$;
create function public.audio_gateway_release_crypto(p_lease uuid) returns void
language sql security definer set search_path='' as $$ delete from private_audio.audio_crypto_leases where id=p_lease $$;

-- One qualified CURRENT revision only; never pick an arbitrary ready asset copy.
create function private_audio.current_playback(p_asset uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('variant_id',v.id,'asset_id',a.id,'storage_path',v.storage_path,
    'size_bytes',v.size_bytes,'duration_ms',v.duration_ms,'source_revision',j.source_revision,
    'title',left(coalesce(a.title,'Трек'),200),'artist_name',left(coalesce(p.artist_name,'Артист'),120))
  from public.assets a join private_audio.media_jobs j on j.asset_id=a.id
  join private_audio.audio_playback_variants v on v.id=j.variant_id and v.asset_id=a.id
  left join public.profiles p on p.id=a.owner_id
  where a.id=p_asset and a.kind='audio' and a.visibility='unlisted' and not a.download_enabled
    and a.track_type in ('demo','unreleased','exclusive')
    and j.status='completed' and j.source_path=a.storage_path
    and j.source_revision=private_audio.source_revision(a.id)
    and j.output_profile_version='mp3-192-v1' and v.output_profile_version=j.output_profile_version
    and v.status='ready' and v.cleanup_after is null and v.output_sha256 is not null
    and v.bitrate_kbps=192 and v.mime_type='audio/mpeg' and v.size_bytes between 1 and 50000000
    and exists(select 1 from storage.objects o where o.bucket_id='audio-playback' and o.name=v.storage_path);
$$;
create function private_audio.safe_share(l private_audio.audio_share_links) returns jsonb
language sql stable set search_path='' as $$
  select jsonb_build_object('id',l.id,'assetId',l.asset_id,'label',l.label,'accessMode',l.access_mode,
    'createdAt',l.created_at,'expiresAt',l.expires_at,'revokedAt',l.revoked_at)
$$;

create function public.audio_gateway_admit(p_subject text,p_client text,p_ip text,p_crypto boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare delay int; lease uuid;
begin
  delay:=private_audio.gateway_limit('manage',p_subject,p_client,p_ip);
  if delay>0 then return jsonb_build_object('retry_after',delay); end if;
  if p_crypto then
    lease:=private_audio.claim_crypto();
    if lease is null then return jsonb_build_object('retry_after',1); end if;
  end if;
  return jsonb_build_object('lease_id',lease);
end $$;

-- Actor comes exclusively from server-verified Supabase Auth, never request JSON.
create function public.audio_gateway_owner(p_actor uuid,p_action text,p_target uuid,p_values jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.assets; l private_audio.audio_share_links; mode text; exp timestamptz; items jsonb; more boolean;
begin
  if p_actor is null then return jsonb_build_object('error','FORBIDDEN'); end if;
  if private_audio.take_rate('owner:'||p_actor::text,60,60)>0 then return jsonb_build_object('error','SHARE_LIMIT'); end if;
  if p_action in ('create','list','check_asset') then
    select * into a from public.assets where id=p_target for share;
  else
    select * into l from private_audio.audio_share_links where id=p_target for update;
    if not found then return jsonb_build_object('error','FORBIDDEN'); end if;
    select * into a from public.assets where id=l.asset_id for share;
  end if;
  if a.owner_id is distinct from p_actor then return jsonb_build_object('error','FORBIDDEN'); end if;
  if p_action='check_asset' then
    return case when private_audio.current_playback(a.id) is null then jsonb_build_object('error','AUDIO_NOT_READY') else '{}'::jsonb end;
  end if;
  if p_action='check_share' then
    return case when l.revoked_at is not null then jsonb_build_object('error','LINK_REVOKED') else '{}'::jsonb end;
  end if;
  if p_action='list' then
    with page as (
      select s.* from private_audio.audio_share_links s where s.asset_id=a.id
        and (p_values->>'before_at' is null or (s.created_at,s.id)<((p_values->>'before_at')::timestamptz,(p_values->>'before_id')::uuid))
      order by s.created_at desc,s.id desc limit 101
    ), numbered as (select page.*,row_number() over(order by created_at desc,id desc) n from page)
    select coalesce(jsonb_agg(private_audio.safe_share(s) order by s.created_at desc,s.id desc) filter(where numbered.n<=100),'[]'::jsonb),count(*)>100
      into items,more from numbered join private_audio.audio_share_links s using(id);
    return jsonb_build_object('shares',items,'has_more',more);
  end if;
  if p_action='revoke' then
    update private_audio.audio_share_links set revoked_at=coalesce(revoked_at,now()) where id=l.id returning * into l;
    return private_audio.safe_share(l);
  end if;
  if p_action in ('patch','rotate') and l.revoked_at is not null then return jsonb_build_object('error','LINK_REVOKED'); end if;
  if p_action='rotate' then
    update private_audio.audio_share_links set token_hash=p_values->>'token_hash' where id=l.id returning * into l;
    return private_audio.safe_share(l);
  end if;
  if p_action='create' then
    if private_audio.current_playback(a.id) is null then return jsonb_build_object('error','AUDIO_NOT_READY'); end if;
    perform pg_advisory_xact_lock(hashtextextended(p_actor::text,21414004));
    if (select count(*) from private_audio.audio_share_links where created_by=p_actor and revoked_at is null and (expires_at is null or expires_at>clock_timestamp()))>=100
      or (select count(*) from private_audio.audio_share_links where asset_id=a.id and revoked_at is null and (expires_at is null or expires_at>clock_timestamp()))>=20 then
      return jsonb_build_object('error','SHARE_LIMIT'); end if;
  elsif p_action<>'patch' then return jsonb_build_object('error','INVALID_REQUEST'); end if;
  mode:=coalesce(p_values->>'access_mode',l.access_mode,'link');
  exp:=case when p_values ? 'expires_at' then (p_values->>'expires_at')::timestamptz else l.expires_at end;
  if exp is not null and (exp<=clock_timestamp() or exp>clock_timestamp()+interval '365 days') then return jsonb_build_object('error','INVALID_REQUEST'); end if;
  if p_action='create' then
    insert into private_audio.audio_share_links(asset_id,created_by,token_hash,pin_hash,access_mode,label,expires_at)
      values(a.id,p_actor,p_values->>'token_hash',p_values->>'pin_hash',mode,p_values->>'label',exp) returning * into l;
  else
    update private_audio.audio_share_links set
      label=case when p_values ? 'label' then p_values->>'label' else label end,
      access_mode=mode,pin_hash=case when mode='link' then null when p_values ? 'pin_hash' then p_values->>'pin_hash' else pin_hash end,
      expires_at=exp where id=l.id returning * into l;
  end if;
  return private_audio.safe_share(l);
end $$;

create function public.audio_gateway_access(p_token text,p_client text,p_ip text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l private_audio.audio_share_links; delay int; lease uuid;
begin
  delay:=private_audio.gateway_limit('access',p_token,p_client,p_ip);
  if delay>0 then return jsonb_build_object('retry_after',delay); end if;
  select * into l from private_audio.audio_share_links where token_hash=p_token and revoked_at is null
    and (expires_at is null or expires_at>clock_timestamp());
  if l.id is not null and private_audio.current_playback(l.asset_id) is null then l:=null; end if;
  if l.id is null or l.access_mode='pin' then
    -- Reserve before KDF. Correct authorization resets these scoped counters.
    -- No five-attempt global link lockout: other IPs/clients remain independent.
    delay:=greatest(private_audio.take_rate('pin-ip:'||p_token||':'||p_ip,5,900),
      private_audio.take_rate('pin-client:'||p_token||':'||p_client,5,900));
    if delay>0 then return jsonb_build_object('retry_after',delay); end if;
    lease:=private_audio.claim_crypto();
    if lease is null then
      -- No hash was allowed to run; do not consume a recipient's PIN quota.
      -- take_rate still holds both row locks in this transaction.
      delete from private_audio.audio_rate_limits where used=1 and key_hash in (
        private_audio.rate_key('pin-ip:'||p_token||':'||p_ip),private_audio.rate_key('pin-client:'||p_token||':'||p_client));
      update private_audio.audio_rate_limits set used=used-1 where used>1 and key_hash in (
        private_audio.rate_key('pin-ip:'||p_token||':'||p_ip),private_audio.rate_key('pin-client:'||p_token||':'||p_client));
      return jsonb_build_object('retry_after',1);
    end if;
  end if;
  return jsonb_build_object('lease_id',lease,'link',case when l.id is null then null else
    jsonb_build_object('id',l.id,'epoch',l.authorization_epoch,'access_mode',l.access_mode,'pin_hash',l.pin_hash) end);
end $$;

create function public.audio_gateway_issue(p_token text,p_epoch uuid,p_secret text,p_client text,p_ip text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l private_audio.audio_share_links; s private_audio.audio_playback_sessions; context jsonb; delay int;
begin
  select * into l from private_audio.audio_share_links where token_hash=p_token for share;
  if not found or l.authorization_epoch is distinct from p_epoch or l.revoked_at is not null
    or (l.expires_at is not null and l.expires_at<=clock_timestamp()) then return jsonb_build_object('denied',true); end if;
  context:=private_audio.current_playback(l.asset_id);
  if context is null then return jsonb_build_object('denied',true); end if;
  delay:=private_audio.take_rate('sessions:'||p_token||':'||p_client,10,60);
  if delay>0 then return jsonb_build_object('retry_after',delay); end if;
  insert into private_audio.audio_playback_sessions(share_link_id,session_secret_hash,variant_id,source_revision,authorization_epoch,expires_at)
    values(l.id,p_secret,(context->>'variant_id')::uuid,context->>'source_revision',l.authorization_epoch,
      least(now()+interval '30 minutes',coalesce(l.expires_at,now()+interval '30 minutes'))) returning * into s;
  delete from private_audio.audio_rate_limits where key_hash in (
    private_audio.rate_key('pin-ip:'||p_token||':'||p_ip),private_audio.rate_key('pin-client:'||p_token||':'||p_client));
  return jsonb_build_object('id',s.id,'expires_at',s.expires_at,'metadata',
    jsonb_build_object('title',context->>'title','artistName',context->>'artist_name',
      'durationMs',context->'duration_ms','cover',null,'accessState','authorized'));
end $$;

create function public.audio_gateway_stream(p_session uuid,p_secret text,p_client text,p_ip text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s private_audio.audio_playback_sessions; l private_audio.audio_share_links; context jsonb; delay int;
begin
  delay:=private_audio.gateway_limit('stream',p_session::text,p_client,p_ip);
  if delay>0 then return jsonb_build_object('retry_after',delay); end if;
  select * into s from private_audio.audio_playback_sessions where id=p_session and session_secret_hash=p_secret
    and revoked_at is null and expires_at>clock_timestamp();
  if not found then return jsonb_build_object('denied',true); end if;
  select * into l from private_audio.audio_share_links where id=s.share_link_id;
  if not found or l.revoked_at is not null or l.authorization_epoch is distinct from s.authorization_epoch
    or (l.expires_at is not null and l.expires_at<=clock_timestamp()) then return jsonb_build_object('denied',true); end if;
  context:=private_audio.current_playback(l.asset_id);
  if context is null or (context->>'variant_id')::uuid is distinct from s.variant_id
    or context->>'source_revision' is distinct from s.source_revision then return jsonb_build_object('denied',true); end if;
  return jsonb_build_object('storage_path',context->>'storage_path','size_bytes',context->'size_bytes','mime_type','audio/mpeg');
end $$;

revoke all on function private_audio.advance_link_epoch(),private_audio.guard_session_binding(),private_audio.rate_key(text),
  private_audio.take_rate(text,int,int),private_audio.gateway_limit(text,text,text,text),private_audio.claim_crypto(),
  private_audio.current_playback(uuid),private_audio.safe_share(private_audio.audio_share_links)
  from public,anon,authenticated,service_role,unit_audio_backend,unit_audio_gateway;
revoke all on function public.audio_gateway_release_crypto(uuid),public.audio_gateway_admit(text,text,text,boolean),
  public.audio_gateway_owner(uuid,text,uuid,jsonb),public.audio_gateway_access(text,text,text),
  public.audio_gateway_issue(text,uuid,text,text,text),public.audio_gateway_stream(uuid,text,text,text)
  from public,anon,authenticated,unit_audio_backend;
grant execute on function public.audio_gateway_release_crypto(uuid),public.audio_gateway_admit(text,text,text,boolean),
  public.audio_gateway_owner(uuid,text,uuid,jsonb),public.audio_gateway_access(text,text,text),
  public.audio_gateway_issue(text,uuid,text,text,text),public.audio_gateway_stream(uuid,text,text,text)
  to service_role,unit_audio_gateway;
commit;
