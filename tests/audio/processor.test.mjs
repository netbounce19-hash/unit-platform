import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config, localCredentials } from '../../workers/audio/config.mjs';
import { run, convert, probe } from '../../workers/audio/ffmpeg.mjs';
import { processJob } from '../../workers/audio/processor.mjs';
import { fileHash, validateJob } from '../../workers/audio/storage.mjs';
import { assertResources } from '../../workers/audio/resources.mjs';

const cfg = config();
let available = true;
try { await run(cfg.ffmpeg, ['-version']); await run(cfg.ffprobe, ['-version']); } catch { available = false; }
const media = (name, fn) => test(name, { skip: !available && 'FFmpeg/FFprobe unavailable: real media test NOT RUN' }, fn);

test('fail closed credentials, config and arbitrary paths', () => {
  assert.throws(() => localCredentials({}), /DISPOSABLE_REQUIRED/);
  assert.throws(() => localCredentials({ UNIT_AUDIO_DISPOSABLE: 'yes', UNIT_TEST_SUPABASE_URL: 'https://prod.supabase.co' }), /LOCAL_ONLY/);
  assert.throws(() => localCredentials({ UNIT_AUDIO_DISPOSABLE: 'yes', UNIT_TEST_SUPABASE_URL: 'http://localhost:55421',
    UNIT_TEST_SUPABASE_SERVICE_ROLE_KEY: 'a.'+Buffer.from(JSON.stringify({ role: 'service_role', ref: 'hosted', iss: 'supabase-demo' })).toString('base64url')+'.b' }), /LOCAL_KEY_REQUIRED/);
  assert.throws(() => config({ MAX_CONCURRENT_JOBS: '3' }), /INVALID_CONFIG/);
  assert.throws(() => config({ MAX_CONCURRENT_JOBS: '1.5' }), /INVALID_CONFIG/);
  assert.throws(() => validateJob({ source_path: 'http://evil' }), /INVALID_JOB/);
});

test('bounded child timeout and spawn failure', async () => {
  await assert.rejects(run(process.execPath, ['-e', 'setTimeout(()=>{},10000)'], { timeoutMs: 20 }), /PROCESS_TIMEOUT/);
  await assert.rejects(run('/unit-does-not-exist', []), /PROCESS_UNAVAILABLE/);
});
test('unbounded developer host cannot start worker entry', {skip:process.platform==='linux'}, async () => {
  await assert.rejects(assertResources(cfg),/RESOURCE_LIMITS_REQUIRED/);
});

const job = () => { const owner_id = randomUUID(); return { id: randomUUID(), asset_id: randomUUID(), owner_id,
  fence: randomUUID(), attempt_count: 1, source_path: owner_id+'/audio/synthetic.wav' }; };
const bytes = async (file, data) => { await writeFile(file, data); return { bytes: data.length, sha256: await fileHash(file) }; };

test('hash cache avoids FFmpeg and temp files are always removed', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'unit-audio-test-'));
  const local = config({ AUDIO_TEMP_ROOT: dir });
  const calls = [], logs = [];
  const io = { download: fileJob => fileJob,
    rpc: async name => { calls.push(name); return name === 'media_resolve' ? { reused: true } : true; } };
  io.download = async (_job, file) => bytes(file, Buffer.from('content already hashed and validated by earlier job'));
  try {
    assert.deepEqual(await processJob(job(), io, local, undefined, s => logs.push(JSON.parse(s))), { reused: true });
    assert(!calls.includes('media_complete'));
    assert.deepEqual(await readdir(dir), []);
    assert.equal(logs[0].result, 'cache_hit');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

for (const [extension, encoder, expected] of [['wav','pcm_s24le','transcode'], ['flac','flac','transcode'], ['aiff','pcm_s16be','transcode'], ['mp3','libmp3lame','stream_copy']]) {
  media(`${extension} -> validated private-profile MP3; source immutable`, async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'unit-audio-media-'));
    try {
      const src = path.join(dir, 'input.'+extension), dst = path.join(dir, 'output.mp3');
      await run(cfg.ffmpeg, ['-nostdin','-v','error','-f','lavfi','-i','sine=frequency=440:duration=1',
        '-ar','44100','-ac','2','-c:a',encoder,...(extension === 'mp3' ? ['-b:a','192k'] : []),
        '-metadata','title=PRIVATE FIXTURE TITLE',src]);
      const hash = await fileHash(src);
      const result = await convert(src,dst,cfg);
      assert.equal(result.strategy, expected);
      assert(result.output_bytes > 1000 && result.duration_ms > 900);
      assert.equal(await fileHash(src), hash);
      const tags = await run(cfg.ffprobe,['-v','error','-show_entries','format_tags','-of','json',dst]);
      assert(!tags.output.includes('PRIVATE FIXTURE TITLE'));
    } finally { await rm(dir,{ recursive:true,force:true }); }
  });
}

media('invalid, empty, video-only and duration limit rejected', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'unit-audio-invalid-'));
  try {
    for (const value of ['', 'RIFF corrupt synthetic WAV']) {
      const file = path.join(dir,'bad.wav'); await writeFile(file,value);
      await assert.rejects(probe(file,cfg), /INVALID_MEDIA/);
    }
    const video = path.join(dir,'video.mkv');
    await run(cfg.ffmpeg,['-v','error','-f','lavfi','-i','color=black:size=16x16:duration=0.1','-an',video]);
    await assert.rejects(probe(video,cfg), /UNSUPPORTED_MEDIA/);
    const long = path.join(dir,'long.wav');
    await run(cfg.ffmpeg,['-v','error','-f','lavfi','-i','sine=duration=2',long]);
    await assert.rejects(probe(long,{...cfg,maxDuration:1}), /DURATION_LIMIT/);
  } finally { await rm(dir,{recursive:true,force:true}); }
});

for (const failure of ['upload','commit','heartbeat']) {
  media(`worker ${failure} failure: sanitized error, no unsafe delete, temp cleanup`, async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'unit-audio-failure-'));
    const src = path.join(dir,'fixture.wav');
    await run(cfg.ffmpeg,['-v','error','-f','lavfi','-i','sine=duration=0.2','-ac','2',src]);
    const data = await readFile(src), j = job(), calls = [], logs = [];
    const io = {
      download: async (_j,file) => bytes(file,data),
      upload: async () => { if (failure==='upload') throw new Error('private token must never be logged'); return { uploaded:100,verified:0 }; },
      rpc: async (name) => {
        calls.push(name);
        if ((failure==='commit' && name==='media_complete') || (failure==='heartbeat' && name==='media_heartbeat')) throw new Error('private error');
        return name==='media_resolve' ? { reused:false,variant_id:j.asset_id,storage_path:`${j.owner_id}/${j.asset_id}/${j.asset_id}.mp3` } : true;
      },
    };
    try {
      const result = await processJob(j,io,{...cfg,tempRoot:dir},undefined,s=>logs.push(s));
      assert(result.error);
      assert(calls.includes('media_fail'));
      assert(!logs.join('').includes('private token'));
      assert.deepEqual(await readdir(dir),['fixture.wav']);
    } finally { await rm(dir,{recursive:true,force:true}); }
  });
}
