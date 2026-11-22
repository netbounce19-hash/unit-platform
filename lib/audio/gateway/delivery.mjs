import { GatewayError } from './security.mjs';

export const privacyHeaders={
  'Cache-Control':'private, no-store, max-age=0','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store',
  'Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, noarchive, nosnippet','X-Content-Type-Options':'nosniff',
  'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",
};
export function byteRange(header,size) {
  if(!Number.isSafeInteger(size)||size<1||size>50000000)throw new GatewayError(502,'UPSTREAM_INVALID');
  if(header===null)return {start:0,end:size-1,partial:false};
  if(header.length>80)throw new GatewayError(416,'INVALID_RANGE');
  const match=/^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if(!match||(!match[1]&&!match[2]))throw new GatewayError(416,'INVALID_RANGE');
  const first=match[1]?BigInt(match[1]):null,last=match[2]?BigInt(match[2]):null,total=BigInt(size);
  let start,end;
  if(first===null){if(last===0n)throw new GatewayError(416,'INVALID_RANGE');start=last>=total?0n:total-last;end=total-1n;}
  else {start=first;end=last===null||last>=total?total-1n:last;}
  if(start>=total||end<start)throw new GatewayError(416,'INVALID_RANGE');
  return {start:Number(start),end:Number(end),partial:true};
}

/** Delivery boundary: context is freshly authorized by SQL for EVERY request.
 * Only the fetch implementation knows credentials/object paths; none reach JSON.
 */
export function controlledDelivery(cfg,fetchImpl=fetch) {
  const delivery={async open(context,range,signal) {
    if(!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.mp3$/.test(context.storage_path))throw new GatewayError(502,'UPSTREAM_INVALID');
    const ctl=new AbortController();
    const combined=AbortSignal.any([signal,ctl.signal,AbortSignal.timeout(cfg.streamTimeoutMs)]);
    let response;
    try {
      response=await fetchImpl(`${cfg.base}/storage/v1/object/authenticated/audio-playback/${context.storage_path}`,{
        headers:{apikey:cfg.key,authorization:`Bearer ${cfg.key}`,'Accept-Encoding':'identity',
          ...(range.partial?{Range:`bytes=${range.start}-${range.end}`}:{})},
        cache:'no-store',redirect:'error',signal:combined,
      });
    } catch {ctl.abort();throw new GatewayError(502,'UPSTREAM_UNAVAILABLE');}
    const length=range.end-range.start+1;
    const expectedRange=`bytes ${range.start}-${range.end}/${context.size_bytes}`;
    if(response.status!==(range.partial?206:200) || Number(response.headers.get('content-length'))!==length ||
      !/^audio\/mpeg(?:;|$)/i.test(response.headers.get('content-type')||'') ||
      !['identity',null].includes(response.headers.get('content-encoding')) ||
      (range.partial&&response.headers.get('content-range')!==expectedRange) || !response.body) {
      await response.body?.cancel();ctl.abort();throw new GatewayError(502,'UPSTREAM_INVALID');
    }
    return {body:response.body,abort:()=>ctl.abort()};
  }};
  return {...delivery,respond:(req,context,logger)=>serveStream(req,context,delivery,logger)};
}

export async function serveStream(req,context,delivery,logger=()=>{}) {
  const started=performance.now(),size=Number(context.size_bytes);
  byteRange(null,size);
  const base={...privacyHeaders,'Accept-Ranges':'bytes','Content-Type':'audio/mpeg','Content-Disposition':'inline'};
  // Range is defined for GET; HEAD returns the full representation headers only.
  if(req.method==='HEAD')return new Response(null,{status:200,headers:{...base,'Content-Length':String(size)}});
  let range;
  try{range=byteRange(req.headers.get('range'),size);}catch(e){
    if(e.status===416)return new Response(null,{status:416,headers:{...base,'Content-Range':`bytes */${size}`,'Content-Length':'0'}});
    throw e;
  }
  const opened=await delivery.open(context,range,req.signal),reader=opened.body.getReader();
  const length=range.end-range.start+1,upstreamMs=performance.now()-started;
  let bytes=0,finished=false;
  const report=interrupted=>{if(finished)return;finished=true;logger({event:'audio_stream',status:range.partial?206:200,
    bytes_served:bytes,range:range.partial,upstream_ms:Math.round(upstreamMs),elapsed_ms:Math.round(performance.now()-started),interrupted});};
  const body=new ReadableStream({
    async pull(controller) {
      try {
        const next=await reader.read();
        if(next.done){if(bytes!==length)throw new Error();controller.close();report(false);opened.abort();return;}
        if(bytes+next.value.byteLength>length)throw new Error();
        bytes+=next.value.byteLength;controller.enqueue(next.value);
      } catch {controller.error(new Error('STREAM_INTERRUPTED'));report(true);opened.abort();await reader.cancel().catch(()=>{});}
    },
    async cancel(){report(true);opened.abort();await reader.cancel().catch(()=>{});},
  },{highWaterMark:0});
  return new Response(body,{status:range.partial?206:200,headers:{...base,'Content-Length':String(length),
    ...(range.partial?{'Content-Range':`bytes ${range.start}-${range.end}/${size}`}:{})}});
}
