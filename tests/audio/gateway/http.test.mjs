import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixture.mjs';
import { listenWeb,dispatcher,httpClient } from './http-fixture.mjs';
import { controlledDelivery } from '../../../lib/audio/gateway/delivery.mjs';

test('real loopback HTTP gateway/range upstream; SQL-WASM and Auth fixtures',async()=>{
  const f=await fixture();let upstream,api;
  try {
    // Actual HTTP upstream, exactly bounded requested playback bytes.
    upstream=await listenWeb(req=>{
      assert(new URL(req.url).pathname.endsWith('/audio-playback/'+f.playback));
      const range=req.headers.get('range');
      const [start,end]=range?range.slice(6).split('-').map(Number):[0,f.bytes.length-1];
      const part=f.bytes.subarray(start,end+1);f.transfers.push({start,end,bytes:part.length});
      return new Response(part,{status:range?206:200,headers:{'content-type':'audio/mpeg','content-length':String(part.length),
        ...(range?{'content-range':`bytes ${start}-${end}/${f.bytes.length}`}:{})}});
    });
    f.runtime.delivery=controlledDelivery({...f.cfg,base:upstream.origin});
    api=await listenWeb(dispatcher(f.runtime,e=>f.logs.push(e)),{proxyKey:f.cfg.proxyKey});
    f.cfg.origin=api.origin;
    const client=httpClient(api.origin);
    const created=await client.request(`/api/artist/audio/${f.asset}/shares`,{method:'POST',headers:{authorization:'Bearer owner'},body:{}});
    assert.equal(created.status,201);const link=await created.json(),token=new URL(link.url).hash.slice(3);
    const authorized=await client.request('/api/audio/access',{method:'POST',body:{token}});assert.equal(authorized.status,200);
    const session=await authorized.json();
    const head=await client.request(session.streamPath,{method:'HEAD'});assert.equal(head.status,200);assert.equal(f.transfers.length,0);
    const range=await client.request(session.streamPath,{headers:{range:'bytes=100-199'}});
    assert.equal(range.status,206);assert.equal(range.headers.get('content-range'),'bytes 100-199/8192');
    assert.deepEqual(Buffer.from(await range.arrayBuffer()),f.bytes.subarray(100,200));
    assert.equal(f.transfers.at(-1).bytes,100);
    const full=await client.request(session.streamPath);assert.deepEqual(Buffer.from(await full.arrayBuffer()),f.bytes);
    assert.equal((await client.request(session.streamPath,{headers:{range:'bytes=999999-'}})).status,416);
    assert.equal((await client.request(`/api/artist/audio/shares/${link.id}/revoke`,{method:'POST',headers:{authorization:'Bearer owner'},body:{}})).status,200);
    assert.equal((await client.request(session.streamPath,{headers:{range:'bytes=0-0'}})).status,404);
    assert(!JSON.stringify(f.logs).includes(token));
  } finally {await api?.close();await upstream?.close();await f.db.close();}
});
