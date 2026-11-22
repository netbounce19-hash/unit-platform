import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { storage } from '../../workers/audio/storage.mjs';

const env = { UNIT_AUDIO_DISPOSABLE:'yes', UNIT_TEST_SUPABASE_URL:'http://127.0.0.1:55421',
  UNIT_TEST_SUPABASE_SERVICE_ROLE_KEY:'synthetic.'+Buffer.from(JSON.stringify({ iss:'supabase-demo',role:'service_role' })).toString('base64url')+'.fixture' };
const sha = value => createHash('sha256').update(value).digest('hex');
const name = `${randomUUID()}/${randomUUID()}/${randomUUID()}.mp3`;

test('streaming put is immutable, success avoids extra output GET', async () => {
  const dir = await mkdtemp(path.join(tmpdir(),'unit-storage-test-'));
  const file = path.join(dir,'output.mp3'), data=Buffer.from('synthetic mp3 bytes');
  await writeFile(file,data);
  let calls=0;
  try {
    const io=storage(env,async (url,opts) => {
      calls++;
      assert.equal(opts.headers['x-upsert'],'false');
      assert.equal(opts.redirect,'error');
      assert(url.includes('/audio-playback/'));
      let count=0; for await(const chunk of opts.body)count+=chunk.length;
      assert.equal(count,data.length);
      return new Response('{}',{status:200});
    });
    assert.deepEqual(await io.upload(name,file,sha(data),1024),{uploaded:data.length,verified:0});
    assert.equal(calls,1);
    await assert.rejects(io.remove('../arbitrary-prefix'),/INVALID_OBJECT_PATH/);
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('duplicate object requires exact bytes, never overwrite or delete', async () => {
  const dir=await mkdtemp(path.join(tmpdir(),'unit-storage-collision-'));
  const file=path.join(dir,'output.mp3'), data=Buffer.from('immutable result');
  await writeFile(file,data);
  try {
    for(const matching of [true,false]) {
      const methods=[];
      const io=storage(env,async (_url,opts) => {
        methods.push(opts.method || 'GET');
        if(opts.method==='POST')return new Response(JSON.stringify({error:'Duplicate',statusCode:'409'}),{status:409});
        return new Response(matching?data:Buffer.from('wrong bytes'));
      });
      if(matching)assert.deepEqual(await io.upload(name,file,sha(data),100),{uploaded:0,verified:data.length});
      else await assert.rejects(io.upload(name,file,sha(data),100),/OUTPUT_COLLISION/);
      assert.deepEqual(methods,['POST','GET']);
    }
    const interrupted=storage(env,async (_url,opts) => opts.method==='POST'
      ? new Response(JSON.stringify({error:'Duplicate'}),{status:409})
      : new Response(new ReadableStream({start(c){c.error(new Error('verification reset'));}})));
    await assert.rejects(interrupted.upload(name,file,sha(data),100),e=>e.code==='STORAGE_UNAVAILABLE' && e.retry);
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('streamed source enforces actual byte limit, not MIME or Content-Length', async () => {
  const dir=await mkdtemp(path.join(tmpdir(),'unit-source-limit-'));
  const owner=randomUUID(), job={id:randomUUID(),asset_id:randomUUID(),owner_id:owner,fence:randomUUID(),source_path:owner+'/audio/source.wav'};
  try {
    const io=storage(env,async () => new Response(Buffer.alloc(20)));
    await assert.rejects(io.download(job,path.join(dir,'input'),10),/SOURCE_SIZE_LIMIT/);
    const empty=storage(env,async () => new Response(Buffer.alloc(0)));
    await assert.rejects(empty.download(job,path.join(dir,'empty'),10),/EMPTY_SOURCE/);
    const unavailable=storage(env,async () => new Response('{}',{status:503}));
    await assert.rejects(unavailable.download(job,path.join(dir,'bad'),10),e=>e.code==='STORAGE_UNAVAILABLE' && e.retry);
    const interrupted=storage(env,async () => new Response(new ReadableStream({start(c){c.error(new Error('network reset'));}})));
    await assert.rejects(interrupted.download(job,path.join(dir,'interrupted'),10),e=>e.code==='STORAGE_UNAVAILABLE' && e.retry);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
