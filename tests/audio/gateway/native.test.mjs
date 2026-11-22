// Real Auth/Storage/SQL + local HTTP bridge. Only run on a newly created stack.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,randomBytes } from 'node:crypto';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { config,localCredentials } from '../../../workers/audio/config.mjs';
import { storage } from '../../../workers/audio/storage.mjs';
import { processJob } from '../../../workers/audio/processor.mjs';
import { run } from '../../../workers/audio/ffmpeg.mjs';
import { gatewayRuntime } from '../../../lib/audio/gateway/runtime.mjs';
import { newSecret } from '../../../lib/audio/gateway/security.mjs';
import { listenWeb,dispatcher,httpClient } from './http-fixture.mjs';

test('native disposable Supabase access/Range gateway',{
  skip:process.env.UNIT_AUDIO_GATEWAY_NATIVE_TEST!=='yes'&&'Native Supabase gate NOT RUN (explicit fresh-stack opt-in required)',
},async()=>{
  assert.equal(process.env.UNIT_DISPOSABLE_SUPABASE,'yes');
  const {base,key}=localCredentials();
  const anon=process.env.UNIT_TEST_SUPABASE_ANON_KEY;assert(anon);
  const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
  const admin=createClient(base,key,options),cfg=config();
  const must=r=>{assert(!r.error,r.error?.message);return r.data;};
  const users=[],originals=[],playbacks=[];let api,org;
  const dir=await mkdtemp(path.join(tmpdir(),'unit-gateway-native-'));
  try {
    const clients=[],tokens=[];
    for(let i=0;i<2;i++) {
      const email=`unit-gateway-${randomUUID()}@example.invalid`,password=randomBytes(24).toString('base64url');
      const u=must(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{artist_name:'Synthetic Artist'}})).user;
      users.push(u.id);const c=createClient(base,anon,options);tokens.push(must(await c.auth.signInWithPassword({email,password})).session.access_token);clients.push(c);
    }
    org=must(await clients[1].rpc('create_label_org',{org_name:'Synthetic Gateway Label'}));
    must(await clients[1].from('artists').insert({org_id:org,user_id:users[0],stage_name:'Synthetic Artist'}));
    const file=path.join(dir,'original.wav');
    await run(cfg.ffmpeg,['-v','error','-f','lavfi','-i','sine=duration=0.5','-ac','2',file]);
    const bytes=await readFile(file),source=`${users[0]}/audio/${randomUUID()}.wav`;originals.push(source);
    must(await clients[0].storage.from('artist-files').upload(source,bytes,{contentType:'audio/wav'}));
    const asset=must(await clients[0].from('assets').insert({owner_id:users[0],kind:'audio',storage_path:source,
      title:'Synthetic private preview',track_type:'unreleased',visibility:'unlisted',download_enabled:false}).select().single());
    must(await clients[0].rpc('request_playback_variant',{p_asset_id:asset.id}));
    const io=storage(),job=await io.rpc('media_claim',{p_worker:randomUUID()});
    assert.equal(job.asset_id,asset.id,'must be fresh isolated stack without other jobs');
    const result=await processJob(job,io,cfg,undefined,()=>{});assert(!result.error,result.error);
    const ready=must(await clients[0].rpc('request_playback_variant',{p_asset_id:asset.id}));
    const playback=`${users[0]}/${asset.id}/${ready.variant_id}.mp3`;playbacks.push(playback);
    const expected=Buffer.from(await must(await admin.storage.from('audio-playback').download(playback)).arrayBuffer());
    const runtime=gatewayRuntime({...process.env,UNIT_AUDIO_GATEWAY_DISPOSABLE:'yes',UNIT_AUDIO_GATEWAY_ORIGIN:'http://127.0.0.1:1',
      UNIT_AUDIO_RATE_HMAC_KEY:newSecret(),UNIT_AUDIO_PROXY_HMAC_KEY:newSecret()});
    api=await listenWeb(dispatcher(runtime),{proxyKey:runtime.cfg.proxyKey});runtime.cfg.origin=api.origin;
    const client=httpClient(api.origin);
    const created=await client.request(`/api/artist/audio/${asset.id}/shares`,{method:'POST',headers:{authorization:'Bearer '+tokens[0]},body:{accessMode:'pin',pin:'123456'}});
    assert.equal(created.status,201);const link=await created.json(),token=new URL(link.url).hash.slice(3);
    assert.equal((await client.request(`/api/artist/audio/${asset.id}/shares`,{method:'POST',headers:{authorization:'Bearer '+tokens[1]},body:{}})).status,403);
    assert.equal((await client.request('/api/audio/access',{method:'POST',body:{token,pin:'654321'}})).status,404);
    const access=await client.request('/api/audio/access',{method:'POST',body:{token,pin:'123456'}});assert.equal(access.status,200);
    const session=await access.json();
    assert.equal((await client.request(session.streamPath,{method:'HEAD'})).status,200);
    for(const range of['bytes=0-0','bytes=10-19','bytes=-10']) {
      const response=await client.request(session.streamPath,{headers:{range}});assert.equal(response.status,206,'native Storage must genuinely return 206');
      const actual=Buffer.from(await response.arrayBuffer());
      assert.deepEqual(actual,range==='bytes=0-0'?expected.subarray(0,1):range==='bytes=-10'?expected.subarray(-10):expected.subarray(10,20));
    }
    assert.deepEqual(Buffer.from(await(await client.request(session.streamPath)).arrayBuffer()),expected);
    for(const c of[clients[0],clients[1],createClient(base,anon,options)])assert((await c.storage.from('audio-playback').download(playback)).error);
    assert((await clients[1].storage.from('artist-files').download(source)).error,'membership alone cannot read original');
    assert.equal((await client.request(`/api/artist/audio/shares/${link.id}/revoke`,{method:'POST',headers:{authorization:'Bearer '+tokens[0]},body:{}})).status,200);
    assert.equal((await client.request(session.streamPath,{headers:{range:'bytes=0-0'}})).status,404);
    assert.equal((await client.request('/api/audio/access',{method:'POST',body:{token,pin:'123456'}})).status,404);
  } finally {
    await api?.close();
    if(originals.length)must(await admin.storage.from('artist-files').remove(originals));
    if(playbacks.length)must(await admin.storage.from('audio-playback').remove(playbacks));
    if(org)must(await admin.from('organizations').delete().eq('id',org));
    for(const id of users)must(await admin.auth.admin.deleteUser(id));
    await rm(dir,{recursive:true,force:true});
  }
});
