// Real local FFmpeg on synthetic audio. No hosted API, no copyrighted fixtures.
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { config, MediaError } from '../../workers/audio/config.mjs';
import { run, convert } from '../../workers/audio/ffmpeg.mjs';
import { processJob } from '../../workers/audio/processor.mjs';

const dir=await mkdtemp(path.join(tmpdir(),'unit-audio-benchmark-'));
const cfg=config({ ...process.env, AUDIO_TEMP_ROOT:dir });
try {
  const wav=path.join(dir,'synthetic.wav');
  await run(cfg.ffmpeg,['-nostdin','-v','error','-f','lavfi','-i','anoisesrc=color=pink:amplitude=0.15:sample_rate=48000:duration=180:seed=42',
    '-ac','2','-c:a','pcm_s24le',wav],{timeoutMs:60000});
  const rows=[];
  for(const format of ['wav','flac','mp3']) {
    const source=path.join(dir,'synthetic.'+format);
    if(format!=='wav') await run(cfg.ffmpeg,['-nostdin','-v','error','-i',wav,'-c:a',format==='flac'?'flac':'libmp3lame',
      ...(format==='mp3'?['-b:a','192k','-ar','44100']:[]),source],{timeoutMs:60000});
    const begin=performance.now();
    const result=await convert(source,path.join(dir,'result-'+format+'.mp3'),cfg);
    const elapsed=performance.now()-begin;
    const input=(await stat(source)).size;
    rows.push({format,input_bytes:input,...result,elapsed_ms:Math.round(elapsed),
      processing_ratio:Number((elapsed/result.duration_ms).toFixed(4)),compression_ratio:Number((result.output_bytes/input).toFixed(4))});
  }
  const owner=randomUUID(),asset=randomUUID();
  const job={id:randomUUID(),owner_id:owner,asset_id:asset,fence:randomUUID(),attempt_count:1,source_path:owner+'/audio/fixture.wav'};
  let reused=false,failUpload=false;
  const io={
    async download(_j,file) {
      const hash=createHash('sha256'); let count=0;
      await pipeline(createReadStream(wav),new Transform({transform(b,_enc,cb){hash.update(b);count+=b.length;cb(null,b);}}),createWriteStream(file));
      return {bytes:count,sha256:hash.digest('hex')};
    },
    async rpc(name){return name==='media_resolve'?{reused,variant_id:asset,storage_path:`${owner}/${asset}/${asset}.mp3`}:true;},
    async upload(){if(failUpload)throw new MediaError('STORAGE_UNAVAILABLE',true);return {uploaded:0,verified:0};},
  };
  const timings={};
  for(const scenario of ['initial','cache_same_bytes_new_revision','upload_failure','recovery']) {
    reused=scenario==='cache_same_bytes_new_revision'; failUpload=scenario==='upload_failure';
    const begin=performance.now();
    const result=await processJob(job,io,cfg,undefined,()=>{});
    timings[scenario]={elapsed_ms:Math.round(performance.now()-begin),...result};
  }
  console.log(JSON.stringify({ffmpeg:(await run(cfg.ffmpeg,['-version'])).output.split('\n')[0],
    note:'CPU/local disk only; Storage/queue mocked in lifecycle timings; excludes real network and retry backoff',rows,timings},null,2));
} finally {await rm(dir,{recursive:true,force:true});}
