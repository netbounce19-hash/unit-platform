import test,{before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixture.mjs';
import { byteRange,controlledDelivery } from '../../../lib/audio/gateway/delivery.mjs';

let f,session;
before(async()=>{f=await fixture();});
after(async()=>{await f?.db.close();});
beforeEach(async()=>{
  await f.db.exec('delete from private_audio.audio_share_links; truncate private_audio.audio_rate_limits,private_audio.audio_crypto_leases;');
  f.cookies.clear();f.transfers.length=0;f.logs.length=0;
  const link=await f.create();session=await(await f.call('access',undefined,{body:{token:link.token}})).json();
  session.link=link;
});

test('strict single Range parser: suffix/open/clamp and invalid ranges',()=>{
  assert.deepEqual(byteRange('bytes=0-0',100),{start:0,end:0,partial:true});
  assert.deepEqual(byteRange('bytes=20-',100),{start:20,end:99,partial:true});
  assert.deepEqual(byteRange('bytes=-10',100),{start:90,end:99,partial:true});
  assert.deepEqual(byteRange('bytes=-200',100),{start:0,end:99,partial:true});
  assert.deepEqual(byteRange('bytes=20-200',100),{start:20,end:99,partial:true});
  for(const invalid of['bytes=100-','bytes=20-10','bytes=-0','bytes=-','bytes=0-1,3-5','items=0-1','bytes=999999999999999999-'])assert.throws(()=>byteRange(invalid,100));
});
test('full GET is exact playback bytes; HEAD transfers zero upstream bytes',async()=>{
  const head=await f.call('stream',session.sessionId,{method:'HEAD',headers:{range:'bytes=0-0'}});
  assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),String(f.bytes.length));assert.equal(f.transfers.length,0);
  const get=await f.call('stream',session.sessionId,{method:'GET'});
  assert.equal(get.status,200);assert.equal(get.headers.get('content-type'),'audio/mpeg');
  assert.deepEqual(Buffer.from(await get.arrayBuffer()),f.bytes); // Only 8 KiB synthetic byte fixture.
  assert.equal(f.transfers[0].bytes,f.bytes.length);
});
test('first/middle/EOF/suffix ranges have exact headers and byte slices',async()=>{
  for(const range of['bytes=0-0','bytes=100-199',`bytes=${f.bytes.length-10}-`,'bytes=-15']) {
    const expected=byteRange(range,f.bytes.length);
    const res=await f.call('stream',session.sessionId,{method:'GET',headers:{range}});
    assert.equal(res.status,206);
    assert.equal(res.headers.get('content-range'),`bytes ${expected.start}-${expected.end}/${f.bytes.length}`);
    assert.equal(Number(res.headers.get('content-length')),expected.end-expected.start+1);
    assert.equal(res.headers.get('accept-ranges'),'bytes');
    assert.deepEqual(Buffer.from(await res.arrayBuffer()),f.bytes.subarray(expected.start,expected.end+1));
    assert.equal(f.transfers.at(-1).bytes,expected.end-expected.start+1);
  }
});
test('bad/multipart/unsatisfiable Range is 416 without any Storage request',async()=>{
  for(const range of['bytes=999999-','invalid','bytes=1-0','bytes=0-1,3-4']) {
    const res=await f.call('stream',session.sessionId,{method:'GET',headers:{range}});
    assert.equal(res.status,416);assert.equal(res.headers.get('content-range'),'bytes */'+f.bytes.length);
    assert.equal((await res.arrayBuffer()).byteLength,0);
  }
  assert.equal(f.transfers.length,0);
});
test('seeking/parallel requests reauthorize once each; no positive auth cache',async()=>{
  let checks=0;const original=f.runtime.rpc;
  f.runtime.rpc=async(name,args)=>{if(name==='audio_gateway_stream')checks++;return original(name,args);};
  try {
    await Promise.all(Array.from({length:10},async(_,i)=>{
      const res=await f.call('stream',session.sessionId,{method:'GET',headers:{range:`bytes=${i*100}-${i*100+9}`}});
      assert.equal(res.status,206);await res.arrayBuffer();
    }));
    assert.equal(checks,10);assert.equal(f.transfers.length,10);
    await f.call('revoke',session.link.id,{body:{},headers:{authorization:'Bearer owner'}});
    assert.equal((await f.call('stream',session.sessionId,{method:'GET',headers:{range:'bytes=0-1'}})).status,404);
    assert.equal(checks,11);assert.equal(f.transfers.length,10);
  } finally {f.runtime.rpc=original;}
});
test('unexpected upstream 200 cannot masquerade as 206 or trigger full buffering',async()=>{
  let cancelled=false;
  const io=controlledDelivery(f.cfg,async()=>new Response(new ReadableStream({cancel(){cancelled=true;}}),{
    status:200,headers:{'content-type':'audio/mpeg','content-length':String(f.bytes.length)},
  }));
  const old=f.runtime.delivery;f.runtime.delivery=io;
  try {
    const res=await f.call('stream',session.sessionId,{method:'GET',headers:{range:'bytes=0-0'}});
    assert.equal(res.status,502);assert.equal(res.headers.get('content-range'),null);assert(cancelled);
  } finally {f.runtime.delivery=old;}
});
test('bad Content-Range/length/type/encoding fail closed',async()=>{
  const old=f.runtime.delivery;
  try {
    for(const change of[{'content-range':'bytes 1-1/8192'},{'content-length':'8192'},{'content-type':'audio/wav'},{'content-encoding':'gzip'}]) {
      f.runtime.delivery=controlledDelivery(f.cfg,async()=>new Response(Buffer.from([1]),{status:206,headers:{
        'content-range':'bytes 0-0/8192','content-length':'1','content-type':'audio/mpeg',...change,
      }}));
      assert.equal((await f.call('stream',session.sessionId,{method:'GET',headers:{range:'bytes=0-0'}})).status,502);
    }
  } finally {f.runtime.delivery=old;}
});
test('cancelled and interrupted streams cancel upstream and emit only safe metrics',async()=>{
  const res=await f.call('stream',session.sessionId,{method:'GET'});
  const reader=res.body.getReader();await reader.read();await reader.cancel();
  assert(f.logs.some(x=>x.event==='audio_stream'&&x.interrupted&&x.bytes_served<f.bytes.length));
  assert(!JSON.stringify(f.logs).includes(session.link.token));assert(!JSON.stringify(f.logs).includes(f.playback));
  const old=f.runtime.delivery;
  f.runtime.delivery=controlledDelivery(f.cfg,async()=>new Response(new ReadableStream({pull(c){c.error(new Error('private upstream details'));}}),{
    headers:{'content-type':'audio/mpeg','content-length':String(f.bytes.length)},
  }));
  try {await assert.rejects((await f.call('stream',session.sessionId,{method:'GET'})).arrayBuffer(),/STREAM_INTERRUPTED/);}
  finally {f.runtime.delivery=old;}
});
test('already-open stream may finish after revoke; next Range is forbidden',async()=>{
  const opened=await f.call('stream',session.sessionId,{method:'GET'});
  await f.call('revoke',session.link.id,{body:{},headers:{authorization:'Bearer owner'}});
  assert.deepEqual(Buffer.from(await opened.arrayBuffer()),f.bytes);
  assert.equal((await f.call('stream',session.sessionId,{method:'GET',headers:{range:'bytes=0-0'}})).status,404);
});
test('slow consumer applies backpressure instead of reading entire upstream',async()=>{
  let pulls=0,cancels=0;
  const old=f.runtime.delivery;
  f.runtime.delivery=controlledDelivery(f.cfg,async()=>new Response(new ReadableStream({
    pull(c){pulls++;c.enqueue(new Uint8Array(64));},cancel(){cancels++;},
  }),{headers:{'content-type':'audio/mpeg','content-length':String(f.bytes.length)}}));
  try {
    const res=await f.call('stream',session.sessionId,{method:'GET'});
    await new Promise(resolve=>setTimeout(resolve,20));assert(pulls<=1);
    const reader=res.body.getReader();await reader.read();await new Promise(resolve=>setTimeout(resolve,20));
    assert(pulls<=2);await reader.cancel();assert.equal(cancels,1);
  } finally {f.runtime.delivery=old;}
});
test('upstream header timeout fails closed without a fabricated body',async()=>{
  const old=f.runtime.delivery;
  f.runtime.delivery=controlledDelivery({...f.cfg,streamTimeoutMs:20},async(_url,options)=>new Promise((_resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('fixture deadline')),500);
    options.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('private timeout details'));},{once:true});
  }));
  try{assert.equal((await f.call('stream',session.sessionId,{method:'GET'})).status,502);}
  finally{f.runtime.delivery=old;}
});
