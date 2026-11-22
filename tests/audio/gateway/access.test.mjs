import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from './fixture.mjs';
import { newSecret,digest,sessionCookieName,gatewayConfig,proxySignature } from '../../../lib/audio/gateway/security.mjs';
import { hashPin,verifyPin } from '../../../lib/audio/gateway/pins.mjs';

let f;
before(async()=>{f=await fixture();});
after(async()=>{await f?.db.close();});
beforeEach(async()=>{
  await f.db.exec('reset role; delete from private_audio.audio_share_links; truncate private_audio.audio_rate_limits,private_audio.audio_crypto_leases;');
  await f.q('delete from public.assets where id<>$1',[f.asset]);
  await f.db.exec('truncate private_audio.media_cleanup');
  await f.q("update public.assets set visibility='unlisted',storage_path=$1 where id=$2",[f.source,f.asset]);
  await f.q("update private_audio.audio_playback_variants set status='ready',error_code=null where id=$1",[f.variant]);
  f.cookies.clear();f.logs.length=0;f.transfers.length=0;
});

test('tokens have 256 random bits and only digests are stored/revealed once',async()=>{
  const seen=new Set(Array.from({length:100},newSecret));assert.equal(seen.size,100);
  assert([...seen].every(x=>x.length===43&&Buffer.from(x,'base64url').length===32));
  const link=await f.create();
  assert.equal(new URL(link.url).pathname,'/u');assert(new URL(link.url).hash.startsWith('#t='));
  const row=(await f.q('select token_hash from private_audio.audio_share_links where id=$1',[link.id]))[0];
  assert.equal(row.token_hash,digest(link.token));assert.notEqual(row.token_hash,link.token);
  const list=await(await f.call('list',f.asset,{method:'GET',headers:{authorization:'Bearer owner'}})).json();
  assert.equal(list.shares.length,1);assert(!JSON.stringify(list).includes(link.token));
  assert(!JSON.stringify(list).includes('hash'));assert(!JSON.stringify(list).includes('storage_path'));
});
test('real Argon2id hashes salted independently; wrong, malformed and dummy PINs fail',async()=>{
  const a=await hashPin('123456'),b=await hashPin('123456');assert.notEqual(a,b);
  assert(a.startsWith('$argon2id$v=19$m=65536,t=3,p=1$'));
  assert(await verifyPin(a,'123456'));assert.equal(await verifyPin(a,'654321'),false);
  assert.equal(await verifyPin(null,'123456'),false);assert.equal(await verifyPin(a,'abc'),false);
});
test('Link Only issues secret only in scoped secure HttpOnly cookie',async()=>{
  const link=await f.create();
  const res=await f.call('access',undefined,{body:{token:link.token}});assert.equal(res.status,200);
  const value=await res.json();assert(value.authorized);assert.equal(value.metadata.artistName,'Synthetic Artist');
  assert(!('assetId'in value.metadata));assert.equal(value.metadata.cover,null);
  const cookie=res.headers.getSetCookie().find(c=>c.startsWith(sessionCookieName(value.sessionId)));
  assert(cookie.includes('HttpOnly')&&cookie.includes('Secure')&&cookie.includes('SameSite=Lax'));
  assert(cookie.includes('Path=/api/audio/stream/'+value.sessionId));
  const secret=cookie.split(';')[0].split('=')[1];assert(!JSON.stringify(value).includes(secret));
  const stored=(await f.q('select session_secret_hash from private_audio.audio_playback_sessions where id=$1',[value.sessionId]))[0];
  assert.equal(stored.session_secret_hash,digest(secret));
  assert(res.headers.get('cache-control').includes('no-store'));
});
test('PIN authorizes only a valid PIN; errors are uniform for missing/revoked/wrong/expired',async()=>{
  const pin=await f.create({accessMode:'pin',pin:'123456'});
  const invalid=await f.call('access',undefined,{body:{token:pin.token,pin:'654321'}});
  const missing=await f.call('access',undefined,{body:{token:newSecret(),pin:'123456'}});
  await f.q('update private_audio.audio_share_links set revoked_at=now() where id=$1',[pin.id]);
  const revoked=await f.call('access',undefined,{body:{token:pin.token,pin:'123456'}});
  for(const r of[invalid,missing,revoked]){assert.equal(r.status,404);assert.deepEqual(await r.json(),{error:'ACCESS_DENIED'});}
  const expired=await f.create({accessMode:'pin',pin:'123456'});
  await f.q("update private_audio.audio_share_links set created_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1",[expired.id]);
  assert.equal((await f.call('access',undefined,{body:{token:expired.token,pin:'123456'}})).status,404);
  const active=await f.create({accessMode:'pin',pin:'123456'});
  assert.equal((await f.call('access',undefined,{body:{token:active.token,pin:'123456'}})).status,200);
});
test('five PIN checks persist across API runtimes and cookie churn',async()=>{
  const link=await f.create({accessMode:'pin',pin:'123456'});
  for(let i=0;i<5;i++) {
    f.cookies.clear();
    const r=await f.call('access',undefined,{body:{token:link.token,pin:'654321'}});assert.equal(r.status,404);
  }
  const blocked=await f.call('access',undefined,{body:{token:link.token,pin:'654321'}});
  assert.equal(blocked.status,429);assert(Number(blocked.headers.get('retry-after'))>0);
  // A different trusted IP can still authorize; no global five-attempt link ban.
  assert.equal((await f.call('access',undefined,{body:{token:link.token,pin:'123456'},ip:'127.0.0.2'})).status,200);
});
test('PIN authorization snapshot cannot issue a session after PIN changes',async()=>{
  const link=await f.create({accessMode:'pin',pin:'123456'});
  const context=await f.runtime.rpc('audio_gateway_access',{p_token:digest(link.token),p_client:'c'.repeat(64),p_ip:'d'.repeat(64)});
  await f.call('patch',link.id,{method:'PATCH',headers:{authorization:'Bearer owner'},body:{pin:'987654'}});
  const result=await f.runtime.rpc('audio_gateway_issue',{p_token:digest(link.token),p_epoch:context.link.epoch,
    p_secret:digest(newSecret()),p_client:'c'.repeat(64),p_ip:'d'.repeat(64)});
  assert.deepEqual(result,{denied:true});
  await f.runtime.rpc('audio_gateway_release_crypto',{p_lease:context.lease_id});
  assert.equal((await f.q('select count(*)::int n from private_audio.audio_playback_sessions'))[0].n,0);
});
test('rotation and PIN changes invalidate old sessions atomically',async()=>{
  const link=await f.create({accessMode:'pin',pin:'123456'});
  const session=await(await f.call('access',undefined,{body:{token:link.token,pin:'123456'}})).json();
  const changed=await f.call('patch',link.id,{method:'PATCH',headers:{authorization:'Bearer owner'},body:{pin:'987654'}});
  assert.equal(changed.status,200);
  assert.equal((await f.call('stream',session.sessionId,{method:'HEAD'})).status,404);
  assert.equal((await f.call('access',undefined,{body:{token:link.token,pin:'123456'}})).status,404);
  const fresh=await(await f.call('access',undefined,{body:{token:link.token,pin:'987654'}})).json();
  const rotated=await(await f.call('rotate',link.id,{headers:{authorization:'Bearer owner'},body:{}})).json();
  assert(rotated.url);assert.notEqual(rotated.url,link.url);
  assert.equal((await f.call('stream',fresh.sessionId,{method:'HEAD'})).status,404);
  assert.equal((await f.call('access',undefined,{body:{token:link.token,pin:'987654'}})).status,404);
  const token=new URL(rotated.url).hash.slice(3);
  assert.equal((await f.call('access',undefined,{body:{token,pin:'987654'}})).status,200);
});
test('revoke is per link: other links reuse the same one variant',async()=>{
  const a=await f.create(),b=await f.create();
  const sa=await(await f.call('access',undefined,{body:{token:a.token}})).json();
  const sb=await(await f.call('access',undefined,{body:{token:b.token}})).json();
  assert.notEqual(sa.sessionId,sb.sessionId);
  assert(f.cookies.has(sessionCookieName(sa.sessionId))&&f.cookies.has(sessionCookieName(sb.sessionId)));
  assert.equal((await f.call('revoke',a.id,{headers:{authorization:'Bearer owner'},body:{}})).status,200);
  assert.equal((await f.call('stream',sa.sessionId,{method:'HEAD'})).status,404);
  assert.equal((await f.call('stream',sb.sessionId,{method:'HEAD'})).status,200);
  assert.equal((await f.q('select count(*)::int n from private_audio.audio_playback_variants'))[0].n,1);
});
test('other artist and member label cannot manage owner links or spoof actor',async()=>{
  const link=await f.create();
  for(const actor of['other','label'])for(const operation of['create','list','patch','rotate','revoke']) {
    const res=await f.call(operation,['create','list'].includes(operation)?f.asset:link.id,{
      method:operation==='list'?'GET':operation==='patch'?'PATCH':'POST',headers:{authorization:'Bearer '+actor},body:operation==='list'?undefined:{},
    });assert.equal(res.status,403,operation+' '+actor);
  }
  assert.equal((await f.call('create',f.asset,{headers:{authorization:'Bearer other'},body:{owner_id:f.owner}})).status,400);
  await f.db.exec('set role authenticated');
  try{await assert.rejects(f.q("select public.audio_gateway_owner($1,'list',$2,'{}')",[f.owner,f.asset]),/permission denied/);}
  finally{await f.db.exec('reset role');}
});
test('CSRF, untrusted forwarded headers, wrong secret and token query fail',async()=>{
  const a=await f.create();
  assert.equal((await f.call('revoke',a.id,{body:{},origin:'https://evil.example',headers:{authorization:'Bearer owner'}})).status,403);
  assert.equal((await f.call('access',undefined,{signed:false,headers:{'x-forwarded-for':'127.0.0.1'},body:{token:a.token}})).status,403);
  const s=await(await f.call('access',undefined,{body:{token:a.token}})).json();
  f.cookies.set(sessionCookieName(s.sessionId),newSecret());
  assert.equal((await f.call('stream',s.sessionId,{method:'GET'})).status,404);
  const req=f.request('/api/audio/access?token='+a.token,{body:{token:a.token}});
  const {gateway}=await import('../../../lib/audio/gateway/controller.mjs');
  assert.equal((await gateway(req,'access',undefined,f.runtime)).status,400);
});
test('two tracks/tabs use independent scoped session cookies',async()=>{
  const asset=randomUUID(),variant=randomUUID(),source=f.owner+'/audio/second.wav',playback=`${f.owner}/${asset}/${variant}.mp3`;
  await f.q("insert into storage.objects(bucket_id,name)values('artist-files',$1),('audio-playback',$2)",[source,playback]);
  await f.q("insert into public.assets(id,owner_id,kind,storage_path,track_type,visibility)values($1,$2,'audio',$3,'unreleased','unlisted')",[asset,f.owner,source]);
  await f.q("insert into private_audio.audio_playback_variants(id,asset_id,storage_path,source_fingerprint,output_sha256,status,bitrate_kbps,duration_ms,size_bytes)values($1,$2,$3,$4,$5,'ready',192,1000,8192)",[variant,asset,playback,'e'.repeat(64),'f'.repeat(64)]);
  await f.q("insert into private_audio.media_jobs(asset_id,variant_id,source_path,source_revision,status,input_bytes,output_bytes,duration_ms,processing_ms,cpu_ms,downloaded_bytes,uploaded_bytes)values($1,$2,$3,private_audio.source_revision($1),'completed',20000,8192,1000,10,5,20000,8192)",[asset,variant,source]);
  const a=await f.create();
  const b=await(await f.call('create',asset,{headers:{authorization:'Bearer owner'},body:{}})).json();
  const one=await(await f.call('access',undefined,{body:{token:a.token}})).json();
  const two=await(await f.call('access',undefined,{body:{token:new URL(b.url).hash.slice(3)}})).json();
  assert.notEqual(one.sessionId,two.sessionId);
  assert.equal((await f.call('stream',one.sessionId,{method:'HEAD'})).status,200);
  assert.equal((await f.call('stream',two.sessionId,{method:'HEAD'})).status,200);
  const firstSecret=f.cookies.get(sessionCookieName(one.sessionId));
  f.cookies.set(sessionCookieName(two.sessionId),firstSecret);
  assert.equal((await f.call('stream',two.sessionId,{method:'HEAD'})).status,404);
  assert.equal((await f.call('stream',one.sessionId,{method:'HEAD'})).status,200);
});
test('all gateway RPCs/private tables remain closed to browser roles',async()=>{
  const row=(await f.q("select bool_and(not has_function_privilege('anon',p.oid,'execute') and not has_function_privilege('authenticated',p.oid,'execute')) closed from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'audio_gateway_%'"))[0];
  assert.equal(row.closed,true);
  assert.equal((await f.q("select pg_has_role('authenticated','unit_audio_gateway','MEMBER') member"))[0].member,false);
  await f.db.exec('set role authenticated');
  try{await assert.rejects(f.q('select * from private_audio.audio_rate_limits'),/permission denied/);assert.deepEqual(await f.q("select * from storage.objects where bucket_id='audio-playback'"),[]);}
  finally{await f.db.exec('reset role');}
});
test('stale, processing, failed, private and expired contexts cannot stream',async()=>{
  const link=await f.create();const s=await(await f.call('access',undefined,{body:{token:link.token}})).json();
  for(const [status,error]of[['processing',null],['failed','BAD_MEDIA']]) {
    await f.q('update private_audio.audio_playback_variants set status=$1,error_code=$2 where id=$3',[status,error,f.variant]);
    assert.equal((await f.call('stream',s.sessionId,{method:'HEAD'})).status,404);
  }
  await f.q("update private_audio.audio_playback_variants set status='ready',error_code=null where id=$1",[f.variant]);
  const path=f.owner+'/audio/replaced.wav';
  await f.q("insert into storage.objects(bucket_id,name)values('artist-files',$1)",[path]);
  await f.q('update public.assets set storage_path=$1 where id=$2',[path,f.asset]);
  assert.equal((await f.call('stream',s.sessionId,{method:'HEAD'})).status,404);
  await f.q('update public.assets set storage_path=$1 where id=$2',[f.source,f.asset]);
  await f.q("update public.assets set visibility='private' where id=$1",[f.asset]);
  assert.equal((await f.call('stream',s.sessionId,{method:'HEAD'})).status,404);
  await f.q("update public.assets set visibility='unlisted' where id=$1",[f.asset]);
  // Existing session trigger intentionally forbids extending/moving its dates;
  // use a fresh historical row for expiry instead of disabling that trigger.
  const id=randomUUID(),secret=newSecret();
  await f.q("insert into private_audio.audio_playback_sessions(id,share_link_id,session_secret_hash,created_at,authorized_at,expires_at,variant_id,source_revision,authorization_epoch)values($1,$2,$3,now()-interval '2 hours',now()-interval '2 hours',now()-interval '90 minutes',$4,private_audio.source_revision($5),(select authorization_epoch from private_audio.audio_share_links where id=$2))",[id,link.id,digest(secret),f.variant,f.asset]);
  f.cookies.set(sessionCookieName(id),secret);
  assert.equal((await f.call('stream',id,{method:'HEAD'})).status,404);
});
test('production gate rejects real hosts and Vercel regardless of feature flag',()=>{
  assert.throws(()=>gatewayConfig({}),/UNAVAILABLE/);
  assert.throws(()=>gatewayConfig({UNIT_AUDIO_GATEWAY_DISPOSABLE:'yes',VERCEL:'1'}),/UNAVAILABLE/);
  const req=f.request('/api/audio/access',{body:{token:newSecret()}});
  req.headers.set('x-unit-proxy-signature',proxySignature(req,'127.0.0.2',req.headers.get('x-unit-proxy-time'),f.cfg.proxyKey));
  // Altering the signed identity without matching IP cannot pass ingress checks.
  return import('../../../lib/audio/gateway/controller.mjs').then(async({gateway})=>assert.equal((await gateway(req,'access',undefined,f.runtime)).status,403));
});
test('deleted asset cannot issue sessions or serve old ones; cleanup remains exact',async()=>{
  const link=await f.create();const s=await(await f.call('access',undefined,{body:{token:link.token}})).json();
  await f.q('delete from public.assets where id=$1',[f.asset]);
  assert.equal((await f.call('access',undefined,{body:{token:link.token}})).status,404);
  assert.equal((await f.call('stream',s.sessionId,{method:'HEAD'})).status,404);
  assert.equal((await f.q('select storage_path from private_audio.media_cleanup'))[0].storage_path,f.playback);
});

test('owner history is bounded and cursor pagination preserves tied timestamps',async()=>{
  const f=await fixture();
  try {
  const link=await f.create();
  await f.q(`insert into private_audio.audio_share_links(asset_id,created_by,token_hash,access_mode,revoked_at)
    select $1,$2,encode(sha256(convert_to(n::text,'UTF8')),'hex'),'link',now() from generate_series(1,104) n`,[f.asset,f.owner]);
  const first=await(await f.call('list',f.asset,{method:'GET',headers:{authorization:'Bearer owner'}})).json();
  assert.equal(first.shares.length,100);assert(first.nextCursor);
  const second=await(await f.call('list',f.asset,{method:'GET',headers:{authorization:'Bearer owner','x-audio-cursor':first.nextCursor}})).json();
  assert.equal(second.shares.length,5);assert.equal(second.nextCursor,null);
  assert.equal(new Set([...first.shares,...second.shares].map(s=>s.id)).size,105);
  assert([...first.shares,...second.shares].some(s=>s.id===link.id));
  } finally {await f.db.close();}
});
