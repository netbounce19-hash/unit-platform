import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { localCredentials } from '../../../workers/audio/config.mjs';

export class GatewayError extends Error {
  constructor(status, code) { super(code); this.status=status; this.code=code; }
}
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const newSecret=()=>randomBytes(32).toString('base64url');
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const validSecret=value=>typeof value==='string' && /^[A-Za-z0-9_-]{43}$/.test(value) &&
  Buffer.from(value,'base64url').toString('base64url')===value;
const hmac=(key,value)=>createHmac('sha256',key).update(value).digest('hex');

export function gatewayConfig(env=process.env) {
  if(env.UNIT_AUDIO_GATEWAY_DISPOSABLE!=='yes' || env.VERCEL)throw new GatewayError(503,'UNAVAILABLE');
  let credentials;
  try { credentials=localCredentials(env); } catch { throw new GatewayError(503,'UNAVAILABLE'); }
  let origin;
  try { origin=new URL(env.UNIT_AUDIO_GATEWAY_ORIGIN || env.NEXT_PUBLIC_SITE_URL); } catch { throw new GatewayError(503,'UNAVAILABLE'); }
  if(!['localhost','127.0.0.1','[::1]'].includes(origin.hostname) || !['http:','https:'].includes(origin.protocol) ||
    origin.pathname!=='/' || origin.search || origin.hash || origin.username || origin.password)throw new GatewayError(503,'UNAVAILABLE');
  const keys=['UNIT_AUDIO_RATE_HMAC_KEY','UNIT_AUDIO_PROXY_HMAC_KEY'].map(name=>{
    if(!validSecret(env[name]))throw new GatewayError(503,'UNAVAILABLE');
    return Buffer.from(env[name],'base64url');
  });
  if(timingSafeEqual(keys[0],keys[1]))throw new GatewayError(503,'UNAVAILABLE');
  return {...credentials,origin:origin.origin,rateKey:keys[0],proxyKey:keys[1],streamTimeoutMs:240000,denialFloorMs:200};
}
export function normalizeIP(ip) {
  if(isIP(ip)===4)return ip;
  if(isIP(ip)!==6)throw new GatewayError(403,'ACCESS_DENIED');
  const canonical=new URL(`http://[${ip}]/`).hostname.slice(1,-1);
  if(canonical.startsWith('::ffff:')) {
    const words=canonical.slice(7).split(':').map(x=>parseInt(x,16));
    if(words.length===2)return [words[0]>>8,words[0]&255,words[1]>>8,words[1]&255].join('.');
  }
  return canonical;
}
export function proxySignature(req,ip,timestamp,key) {
  return hmac(key,`${timestamp}\n${normalizeIP(ip)}\n${req.method}\n${new URL(req.url).pathname}`);
}
export function identity(req,cfg,now=Date.now()) {
  if(req.headers.get('sec-fetch-site')==='cross-site')throw new GatewayError(403,'ACCESS_DENIED');
  const time=req.headers.get('x-unit-proxy-time'),signature=req.headers.get('x-unit-proxy-signature');
  const ip=normalizeIP(req.headers.get('x-unit-client-ip')||'');
  if(!/^\d{10,13}$/.test(time||'') || Math.abs(now-Number(time))>30000 || !/^[0-9a-f]{64}$/.test(signature||''))throw new GatewayError(403,'ACCESS_DENIED');
  if(!timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(proxySignature(req,ip,time,cfg.proxyKey),'hex')))throw new GatewayError(403,'ACCESS_DENIED');
  let client=cookieValue(req,'__Secure-unit_audio_client');
  const fresh=!validSecret(client);
  if(fresh)client=newSecret();
  const day=Math.floor(now/86400000);
  return {client:hmac(cfg.rateKey,`client:${day}:${client}`),ip:hmac(cfg.rateKey,`ip:${day}:${ip}`),
    clientCookie:fresh?`__Secure-unit_audio_client=${client}; Path=/api; Max-Age=86400; HttpOnly; Secure; SameSite=Lax`:null};
}
export function cookieValue(req,name) {
  const values=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(name+'=')).map(s=>s.slice(name.length+1));
  return values.length===1?values[0]:null;
}
export const sessionCookieName=id=>'__Secure-unit_audio_'+id.replaceAll('-','');
export function sessionCookie(id,secret,seconds) {
  return `${sessionCookieName(id)}=${secret}; Path=/api/audio/stream/${id}; Max-Age=${Math.max(1,Math.min(1800,Math.floor(seconds)))}; HttpOnly; Secure; SameSite=Lax`;
}
export function csrf(req,cfg) {
  if(req.headers.get('origin')!==cfg.origin || !/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')||''))throw new GatewayError(403,'ACCESS_DENIED');
}
export async function jsonBody(req) {
  const reader=req.body?.getReader();
  if(!reader)throw new GatewayError(400,'INVALID_REQUEST');
  let size=0,text=''; const decoder=new TextDecoder();
  try {
    for(;;) {
      const {value,done}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>4096){await reader.cancel();throw new GatewayError(413,'INVALID_REQUEST');}
      text+=decoder.decode(value,{stream:true});
    }
    const body=JSON.parse(text+decoder.decode());
    if(!body || Array.isArray(body) || typeof body!=='object')throw new Error();
    return body;
  } catch(e) {if(e instanceof GatewayError)throw e;throw new GatewayError(400,'INVALID_REQUEST');}
  finally {reader.releaseLock();}
}
