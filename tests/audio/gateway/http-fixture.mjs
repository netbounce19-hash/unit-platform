// Test-only loopback HTTP bridge. Models a trusted ingress, never a deployment.
import http from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { proxySignature } from '../../../lib/audio/gateway/security.mjs';
import { gateway } from '../../../lib/audio/gateway/controller.mjs';

export async function listenWeb(handler,{proxyKey}={}) {
  const server=http.createServer(async(incoming,outgoing)=>{
    const ctl=new AbortController();
    outgoing.once('close',()=>{if(!outgoing.writableFinished)ctl.abort();});
    try {
      const headers=new Headers();
      for(const[name,value]of Object.entries(incoming.headers))if(value!==undefined&&(!proxyKey||!name.startsWith('x-unit-')))headers.set(name,Array.isArray(value)?value.join(','):value);
      const url=`http://127.0.0.1:${server.address().port}${incoming.url}`;
      const request=new Request(url,{method:incoming.method,headers,signal:ctl.signal,
        ...(['GET','HEAD'].includes(incoming.method)?{}:{body:Readable.toWeb(incoming),duplex:'half'})});
      if(proxyKey) {
        const ip=incoming.socket.remoteAddress,time=String(Date.now());
        request.headers.set('x-unit-client-ip',ip);request.headers.set('x-unit-proxy-time',time);
        request.headers.set('x-unit-proxy-signature',proxySignature(request,ip,time,proxyKey));
      }
      const result=await handler(request);
      outgoing.statusCode=result.status;
      for(const[name,value]of result.headers)if(name!=='set-cookie')outgoing.setHeader(name,value);
      if(result.headers.getSetCookie().length)outgoing.setHeader('set-cookie',result.headers.getSetCookie());
      if(!result.body)outgoing.end();else await pipeline(Readable.fromWeb(result.body),outgoing);
    } catch {outgoing.destroy();}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  return {origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise((resolve,reject)=>{
    server.closeAllConnections();server.close(e=>e?reject(e):resolve());
  })};
}
export function dispatcher(runtime,logger=()=>{}) {
  return request=>{
    const path=new URL(request.url).pathname,method=request.method;
    if(path==='/api/audio/access'&&method==='POST')return gateway(request,'access',undefined,runtime,logger);
    let match=/^\/api\/audio\/stream\/([0-9a-f-]+)$/.exec(path);
    if(match&&['GET','HEAD'].includes(method))return gateway(request,'stream',match[1],runtime,logger);
    match=/^\/api\/artist\/audio\/([0-9a-f-]+)\/shares$/.exec(path);
    if(match&&['GET','POST'].includes(method))return gateway(request,method==='GET'?'list':'create',match[1],runtime,logger);
    match=/^\/api\/artist\/audio\/shares\/([0-9a-f-]+)(?:\/(rotate|revoke))?$/.exec(path);
    if(match)return gateway(request,match[2]||(method==='PATCH'?'patch':'unsupported'),match[1],runtime,logger);
    return new Response(null,{status:404});
  };
}
export function httpClient(origin) {
  const cookies=new Map();
  return {cookies,async request(path,{method='GET',body,headers={}}={}) {
    const response=await fetch(origin+path,{method,headers:{origin,'content-type':'application/json',
      cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
    for(const cookie of response.headers.getSetCookie()){const[name,value]=cookie.split(';')[0].split('=');cookies.set(name,value);}
    return response;
  }};
}
