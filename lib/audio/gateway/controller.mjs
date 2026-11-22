import { GatewayError, UUID, newSecret, digest, validSecret, identity, csrf, jsonBody, cookieValue, sessionCookieName, sessionCookie } from './security.mjs';
import { hashPin, verifyPin, validPin } from './pins.mjs';
import { privacyHeaders } from './delivery.mjs';
import { randomInt } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{...privacyHeaders,...headers}});
function limited(value) {
  if(value?.retry_after>0)throw Object.assign(new GatewayError(429,'RATE_LIMITED'),{retryAfter:Math.min(86400,Math.ceil(value.retry_after))});
}
function shareValues(body,create) {
  if(Object.keys(body).some(k=>!['accessMode','pin','label','expiresAt'].includes(k)))throw new GatewayError(400,'INVALID_REQUEST');
  const values={};
  if(body.label!==undefined){if(body.label!==null&&(typeof body.label!=='string'||!body.label.trim()||body.label.length>120))throw new GatewayError(400,'INVALID_REQUEST');values.label=body.label;}
  if(body.expiresAt!==undefined){
    if(body.expiresAt!==null&&(typeof body.expiresAt!=='string'||!/^\d{4}-\d\d-\d\dT/.test(body.expiresAt)||
      !Number.isFinite(Date.parse(body.expiresAt))||Date.parse(body.expiresAt)<=Date.now()||Date.parse(body.expiresAt)>Date.now()+365*86400000))throw new GatewayError(400,'INVALID_REQUEST');
    values.expires_at=body.expiresAt;
  }
  if(body.accessMode!==undefined&&!['link','pin'].includes(body.accessMode))throw new GatewayError(400,'INVALID_REQUEST');
  if(body.pin!==undefined&&!validPin(body.pin))throw new GatewayError(400,'INVALID_REQUEST');
  if(body.accessMode==='link'&&body.pin!==undefined)throw new GatewayError(400,'INVALID_REQUEST');
  if(body.accessMode==='pin'&&body.pin===undefined)throw new GatewayError(400,'INVALID_REQUEST');
  if(create||body.accessMode!==undefined||body.pin!==undefined)values.access_mode=body.accessMode||(body.pin!==undefined?'pin':'link');
  return values;
}
function ownerResult(value) {
  if(value?.error){
    const status={FORBIDDEN:403,AUDIO_NOT_READY:409,LINK_REVOKED:409,SHARE_LIMIT:429,INVALID_REQUEST:400}[value.error]||500;
    throw new GatewayError(status,['FORBIDDEN','AUDIO_NOT_READY','LINK_REVOKED','SHARE_LIMIT','INVALID_REQUEST'].includes(value.error)?value.error:'UNAVAILABLE');
  }
  return value;
}
const safeShare=value=>Object.fromEntries(['id','assetId','label','accessMode','createdAt','expiresAt','revokedAt'].map(key=>[key,value[key]]));

/** Runtime-injected Web API controller, shared by real Next routes and tests.
 * Tests cannot enable production: the real entry ALWAYS constructs guarded runtime.
 * @param {(event: Record<string, unknown>) => void} logger
 */
export async function gateway(req,operation,target,runtime,logger=()=>{}) {
  const started=performance.now(); let who,lease,authorizationMs;
  let response;
  try {
    const {cfg,rpc}=runtime;
    if(new URL(req.url).search)throw new GatewayError(400,'INVALID_REQUEST');
    if(operation==='landing'){response=new Response(null,{status:204,headers:privacyHeaders});return response;}
    if(target&&!UUID.test(target))throw new GatewayError(operation==='stream'?404:400,operation==='stream'?'ACCESS_DENIED':'INVALID_REQUEST');
    who=identity(req,cfg);
    if(['POST','PATCH'].includes(req.method))csrf(req,cfg);
    const bound={p_client:who.client,p_ip:who.ip};
    if(operation==='stream') {
      const secret=cookieValue(req,sessionCookieName(target));
      if(!validSecret(secret))throw new GatewayError(404,'ACCESS_DENIED');
      const context=await rpc('audio_gateway_stream',{p_session:target,p_secret:digest(secret),...bound});
      limited(context);
      if(!context||context.denied)throw new GatewayError(404,'ACCESS_DENIED');
      authorizationMs=performance.now()-started;
      response=await runtime.delivery.respond(req,context,logger);
    } else if(operation==='access') {
      const body=await jsonBody(req);
      if(Object.keys(body).some(k=>!['token','pin'].includes(k))||typeof body.token!=='string'||body.token.length>100||
        (body.pin!==undefined&&(typeof body.pin!=='string'||body.pin.length>32)))throw new GatewayError(400,'INVALID_REQUEST');
      const token=digest(body.token);
      const context=await rpc('audio_gateway_access',{p_token:token,...bound});
      limited(context);lease=context.lease_id;
      const link=context.link;
      const accepted=link?.access_mode==='link' ? true : await verifyPin(link?.pin_hash,body.pin);
      if(!validSecret(body.token)||!link||!accepted)throw new GatewayError(404,'ACCESS_DENIED');
      const secret=newSecret();
      const session=await rpc('audio_gateway_issue',{p_token:token,p_epoch:link.epoch,p_secret:digest(secret),...bound});
      limited(session);
      if(!session||session.denied)throw new GatewayError(404,'ACCESS_DENIED');
      if(!UUID.test(session.id))throw new GatewayError(503,'UNAVAILABLE');
      const seconds=Math.min(1800,Math.floor((Date.parse(session.expires_at)-Date.now())/1000));
      if(!Number.isFinite(seconds)||seconds<1)throw new GatewayError(404,'ACCESS_DENIED');
      response=json({authorized:true,sessionId:session.id,expiresIn:seconds,streamPath:`/api/audio/stream/${session.id}`,metadata:{
        title:session.metadata.title,artistName:session.metadata.artistName,durationMs:session.metadata.durationMs,cover:null,accessState:'authorized',
      }},200,
        {'Set-Cookie':sessionCookie(session.id,secret,seconds)});
    } else {
      const bearer=/^Bearer ([A-Za-z0-9._-]+)$/.exec(req.headers.get('authorization')||'')?.[1];
      if(!bearer)throw new GatewayError(401,'AUTH_REQUIRED');
      const body=['create','patch'].includes(operation)?await jsonBody(req):{};
      const values=['create','patch'].includes(operation)?shareValues(body,operation==='create'):{};
      if(operation==='list'&&req.headers.has('x-audio-cursor')) {
        try {
          const encoded=req.headers.get('x-audio-cursor');
          if(encoded.length>300||!/^[A-Za-z0-9_-]+$/.test(encoded))throw new Error();
          const cursor=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));
          if(!UUID.test(cursor.id)||typeof cursor.createdAt!=='string'||!Number.isFinite(Date.parse(cursor.createdAt)))throw new Error();
          values.before_at=cursor.createdAt;values.before_id=cursor.id;
        }catch{throw new GatewayError(400,'INVALID_REQUEST');}
      }
      const admission=await rpc('audio_gateway_admit',{p_subject:digest(bearer),...bound,p_crypto:body.pin!==undefined});
      limited(admission);lease=admission.lease_id;
      const actor=await runtime.user(bearer);
      if(body.pin!==undefined)ownerResult(await rpc('audio_gateway_owner',{
        p_actor:actor,p_action:operation==='create'?'check_asset':'check_share',p_target:target,p_values:{},
      }));
      if(body.pin!==undefined)values.pin_hash=await hashPin(body.pin);
      let raw;
      if(['create','rotate'].includes(operation)){raw=newSecret();values.token_hash=digest(raw);}
      const value=ownerResult(await rpc('audio_gateway_owner',{p_actor:actor,p_action:operation,p_target:target,p_values:values}));
      response=json({...(operation==='list'?{shares:value.shares.map(safeShare),nextCursor:value.has_more&&value.shares.length?Buffer.from(JSON.stringify({createdAt:value.shares.at(-1).createdAt,id:value.shares.at(-1).id})).toString('base64url'):null}:safeShare(value)),
        ...(raw?{url:`${cfg.origin}/u#${new URLSearchParams({t:raw})}`}:{})},operation==='create'?201:200);
    }
  } catch(e) {
    const status=e instanceof GatewayError?e.status:503;
    if(operation==='access'&&status===404) {
      // Same bounded failure floor + cryptographic jitter after the SAME KDF.
      // Rate limits are enforced before either KDF or delay; no timing claim
      // is made for unqualified deployment hardware/cold starts.
      const wait=runtime.cfg.denialFloorMs+randomInt(0,21)-(performance.now()-started);
      if(wait>0)await sleep(wait);
    }
    response=json({error:e instanceof GatewayError?e.code:'UNAVAILABLE'},status,
      e?.retryAfter?{'Retry-After':String(e.retryAfter)}:{});
  } finally {
    if(lease)try{await runtime.rpc('audio_gateway_release_crypto',{p_lease:lease});}catch{}
  }
  if(who?.clientCookie)response.headers.append('Set-Cookie',who.clientCookie);
  logger({event:'audio_gateway',operation,status:response.status,authorization_ms:Math.round(authorizationMs??performance.now()-started)});
  return response;
}
