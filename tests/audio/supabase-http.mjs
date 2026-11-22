// Optional native integration. ONLY a fresh disposable local stack; no .env.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { config, localCredentials } from '../../workers/audio/config.mjs';
import { storage } from '../../workers/audio/storage.mjs';
import { run } from '../../workers/audio/ffmpeg.mjs';
import { processJob } from '../../workers/audio/processor.mjs';

test('native Auth/Storage/PostgREST media job and browser denial', {
  skip: process.env.UNIT_AUDIO_PIPELINE_TEST!=='yes' && 'Explicit disposable native media test NOT RUN',
}, async () => {
  assert.equal(process.env.UNIT_DISPOSABLE_SUPABASE,'yes');
  const {base,key}=localCredentials();
  const anon=process.env.UNIT_TEST_SUPABASE_ANON_KEY;
  assert(anon);
  const opts={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
  const admin=createClient(base,key,opts),io=storage(),cfg=config();
  const users=[],objects=[],playback=[];
  const dir=await mkdtemp(path.join(tmpdir(),'unit-native-audio-'));
  const must=(r)=>{assert(!r.error,r.error?.message);return r.data;};
  try {
    const clients=[];
    for(let i=0;i<2;i++) {
      const email=`unit-media-${randomUUID()}@example.invalid`,password=randomBytes(24).toString('base64url');
      const user=must(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
      users.push(user.id);
      const c=createClient(base,anon,opts);must(await c.auth.signInWithPassword({email,password}));
      clients.push(c);
    }
    for(const [ext,encoder]of [['wav','pcm_s24le'],['flac','flac'],['aiff','pcm_s16be'],['mp3','libmp3lame']]) {
      const file=path.join(dir,'source.'+ext);
      await run(cfg.ffmpeg,['-v','error','-f','lavfi','-i','sine=duration=1','-ar','44100','-ac','2','-c:a',encoder,
        ...(ext==='mp3'?['-b:a','192k']:[]),file]);
      const source=`${users[0]}/audio/${randomUUID()}.${ext}`;objects.push(source);
      const original=await readFile(file);
      must(await clients[0].storage.from('artist-files').upload(source,original));
      const asset=must(await clients[0].from('assets').insert({owner_id:users[0],kind:'audio',storage_path:source}).select().single());
      assert((await clients[1].rpc('request_playback_variant',{p_asset_id:asset.id})).error);
      const queued=must(await clients[0].rpc('request_playback_variant',{p_asset_id:asset.id}));
      const claim=await io.rpc('media_claim',{p_worker:randomUUID()});
      assert.equal(claim.id,queued.job_id,'stack must be isolated, without other users/jobs');
      const result=await processJob(claim,io,cfg,undefined,()=>{});
      assert(!result.error,result.error);
      const completed=must(await clients[0].rpc('request_playback_variant',{p_asset_id:asset.id}));
      assert.equal(completed.status,'completed');assert.equal(completed.job_id,queued.job_id);
      const object=`${users[0]}/${asset.id}/${completed.variant_id}.mp3`;playback.push(object);
      const rendered=must(await admin.storage.from('audio-playback').download(object));
      assert(rendered.size>0);
      for(const c of [...clients,createClient(base,anon,opts)]) {
        assert((await c.storage.from('audio-playback').download(object)).error);
        assert((await c.storage.from('audio-playback').createSignedUrl(object,30)).error);
      }
      const retained=must(await clients[0].storage.from('artist-files').download(source));
      assert.deepEqual(Buffer.from(await retained.arrayBuffer()),original,'original bytes unchanged');
    }
  } finally {
    if(objects.length)must(await admin.storage.from('artist-files').remove(objects));
    if(playback.length)must(await admin.storage.from('audio-playback').remove(playback));
    for(const id of users)must(await admin.auth.admin.deleteUser(id));
    await rm(dir,{recursive:true,force:true});
  }
});
