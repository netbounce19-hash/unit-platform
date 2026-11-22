// Real loopback HTTP + real synthetic MP3/files. SQL-WASM/Auth fixtures, not
// native Supabase/Vercel/Safari. No production URL or key is accepted here.
import { mkdtemp,rm,stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { fixture } from './fixture.mjs';
import { listenWeb,dispatcher,httpClient } from './http-fixture.mjs';
import { byteRange,controlledDelivery } from '../../../lib/audio/gateway/delivery.mjs';
import { run } from '../../../workers/audio/ffmpeg.mjs';
import { config } from '../../../workers/audio/config.mjs';
import { newSecret } from '../../../lib/audio/gateway/security.mjs';

const cfg=config(),dir=await mkdtemp(path.join(tmpdir(),'unit-gateway-bench-')),f=await fixture();
let api,upstream,file,size,fetched=0;
const rows=[];
try {
  const first=path.join(dir,'three.mp3');
  await run(cfg.ffmpeg,['-v','error','-f','lavfi','-i','sine=frequency=440:duration=180','-ar','44100','-ac','2',
    '-c:a','libmp3lame','-b:a','192k','-id3v2_version','0','-write_id3v1','0',first],{timeoutMs:120000});
  upstream=await listenWeb(req=>{
    assert(new URL(req.url).pathname.endsWith('/audio-playback/'+f.playback));
    const range=byteRange(req.headers.get('range'),size),length=range.end-range.start+1;
    const stream=createReadStream(file,{start:range.start,end:range.end,highWaterMark:65536});
    stream.on('data',chunk=>{fetched+=chunk.length;});
    return new Response(Readable.toWeb(stream,{strategy:{highWaterMark:65536,size:chunk=>chunk.byteLength}}),{
      status:range.partial?206:200,headers:{'content-type':'audio/mpeg','content-length':String(length),
        ...(range.partial?{'content-range':`bytes ${range.start}-${range.end}/${size}`}:{})},
    });
  });
  f.runtime.delivery=controlledDelivery({...f.cfg,base:upstream.origin});
  api=await listenWeb(dispatcher(f.runtime),{proxyKey:f.cfg.proxyKey});f.cfg.origin=api.origin;
  const owner=httpClient(api.origin);
  for(const minutes of[3,10,30]) {
    file=minutes===3?first:path.join(dir,minutes+'.mp3');
    if(minutes!==3)await run(cfg.ffmpeg,['-v','error','-stream_loop','-1','-i',first,'-t',String(minutes*60),
      '-c:a','copy','-id3v2_version','0','-write_id3v1','0',file],{timeoutMs:60000});
    size=(await stat(file)).size;
    await f.q('update private_audio.audio_playback_variants set size_bytes=$1,duration_ms=$2 where id=$3',[size,minutes*60000,f.variant]);
    await f.q('update private_audio.media_jobs set output_bytes=$1,duration_ms=$2 where asset_id=$3',[size,minutes*60000,f.asset]);
    const created=await(await owner.request(`/api/artist/audio/${f.asset}/shares`,{method:'POST',headers:{authorization:'Bearer owner'},body:{}})).json();
    const token=new URL(created.url).hash.slice(3);
    for(const concurrent of[1,10,50]) {
      await f.db.exec('truncate private_audio.audio_rate_limits,private_audio.audio_crypto_leases');
      const listeners=[];
      const auth=[];
      for(let i=0;i<concurrent;i++) {
        const client=httpClient(api.origin),t=performance.now();
        const response=await client.request('/api/audio/access',{method:'POST',body:{token}});assert.equal(response.status,200);
        auth.push(performance.now()-t);listeners.push({client,...await response.json()});
      }
      fetched=0;
      const small=await listeners[0].client.request(listeners[0].streamPath,{headers:{range:'bytes=0-1023'}});
      assert.equal(small.status,206);await small.arrayBuffer();assert.equal(fetched,1024);
      fetched=0;
      const baseline=process.memoryUsage().rss;let peak=baseline;
      const sample=setInterval(()=>{peak=Math.max(peak,process.memoryUsage().rss);},5);
      const start=performance.now();
      const timings=await Promise.all(listeners.map(async({client,streamPath})=>{
        const t=performance.now(),response=await client.request(streamPath);assert.equal(response.status,200);
        const reader=response.body.getReader();let firstByte,bytes=0;
        for(;;){const result=await reader.read();if(result.done)break;firstByte??=performance.now()-t;bytes+=result.value.length;}
        assert.equal(bytes,size);return {ttfb_ms:firstByte,total_ms:performance.now()-t,bytes};
      }));
      clearInterval(sample);peak=Math.max(peak,process.memoryUsage().rss);
      rows.push({minutes,concurrent,size_bytes:size,authorization_mean_ms:auth.reduce((a,b)=>a+b,0)/auth.length,
        ttfb_mean_ms:timings.reduce((a,b)=>a+b.ttfb_ms,0)/timings.length,
        total_mean_ms:timings.reduce((a,b)=>a+b.total_ms,0)/timings.length,
        batch_ms:performance.now()-start,upstream_bytes:fetched,served_bytes:timings.reduce((a,b)=>a+b.bytes,0),
        rss_baseline_bytes:baseline,rss_peak_bytes:peak,rss_delta_bytes:peak-baseline,small_range_upstream_bytes:1024});
    }
  }
  const pinLink=await(await owner.request(`/api/artist/audio/${f.asset}/shares`,{method:'POST',headers:{authorization:'Bearer owner'},body:{accessMode:'pin',pin:'123456'}})).json();
  const revoked=await(await owner.request(`/api/artist/audio/${f.asset}/shares`,{method:'POST',headers:{authorization:'Bearer owner'},body:{accessMode:'pin',pin:'123456'}})).json();
  await owner.request(`/api/artist/audio/shares/${revoked.id}/revoke`,{method:'POST',headers:{authorization:'Bearer owner'},body:{}});
  const deniedTiming={};
  for(const[scenario,token,pin]of[['wrong_pin',new URL(pinLink.url).hash.slice(3),'654321'],['nonexistent',newSecret(),'123456'],['revoked',new URL(revoked.url).hash.slice(3),'123456']]) {
    const samples=[];
    for(let i=0;i<7;i++){
      await f.db.exec('truncate private_audio.audio_rate_limits,private_audio.audio_crypto_leases');
      const t=performance.now(),res=await owner.request('/api/audio/access',{method:'POST',body:{token,pin}});assert.equal(res.status,404);await res.json();samples.push(performance.now()-t);
    }
    samples.sort((a,b)=>a-b);deniedTiming[scenario]={median_ms:samples[3],min_ms:samples[0],max_ms:samples[6]};
  }
  console.log(JSON.stringify({environment:'macOS x86_64, Node 22.11, actual loopback HTTP, real synthetic MP3, SQL-WASM/Auth fixture; NOT native Supabase/Vercel/browser',
    note:'Fast bulk readers, not real-time listeners; RSS is whole-process sampled high-water mark including fixture servers/DB; no statistical constant-time guarantee',rows,denied_timing:deniedTiming},null,2));
}finally{await api?.close();await upstream?.close();await f.db.close();await rm(dir,{recursive:true,force:true});}
