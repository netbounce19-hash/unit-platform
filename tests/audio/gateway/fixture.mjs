// SQL + Web API model, not native GoTrue/Storage or a browser.
import { readFile,readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { gatewayConfig,newSecret,proxySignature } from '../../../lib/audio/gateway/security.mjs';
import { controlledDelivery } from '../../../lib/audio/gateway/delivery.mjs';
import { gateway } from '../../../lib/audio/gateway/controller.mjs';

export async function fixture() {
  const {PGlite}=await import(process.env.UNIT_PGLITE_MODULE||'@electric-sql/pglite');
  const db=new PGlite();
  await db.exec(await readFile(new URL('../../../supabase/tests/private-audio/bootstrap.sql',import.meta.url),'utf8'));
  const folder=new URL('../../../supabase/migrations/',import.meta.url);
  for(const f of(await readdir(folder)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(f,folder),'utf8'));
  const owner=randomUUID(),other=randomUUID(),label=randomUUID(),asset=randomUUID(),variant=randomUUID(),org=randomUUID();
  const source=owner+'/audio/original.wav',playback=`${owner}/${asset}/${variant}.mp3`;
  const bytes=Buffer.from(Array.from({length:8192},(_,i)=>i%251));
  const q=async(sql,args=[])=> (await db.query(sql,args)).rows;
  await q('insert into auth.users(id) values($1),($2),($3)',[owner,other,label]);
  await q("update public.profiles set artist_name='Synthetic Artist' where id=$1",[owner]);
  await q("insert into public.organizations(id,name)values($1,'Synthetic label')",[org]);
  await q("insert into public.memberships(org_id,user_id,role)values($1,$2,'label_admin')",[org,label]);
  await q("insert into public.artists(org_id,user_id,stage_name)values($1,$2,'Synthetic Artist')",[org,owner]);
  await q("insert into storage.objects(bucket_id,name) values('artist-files',$1)",[source]);
  await q("insert into public.assets(id,owner_id,kind,storage_path,title,track_type,visibility)values($1,$2,'audio',$3,'Synthetic Track','unreleased','unlisted')",[asset,owner,source]);
  await q("insert into private_audio.audio_playback_variants(id,asset_id,storage_path,source_fingerprint,output_sha256,status,bitrate_kbps,duration_ms,size_bytes)values($1,$2,$3,$4,$5,'ready',192,1000,$6)",
    [variant,asset,playback,'a'.repeat(64),'b'.repeat(64),bytes.length]);
  await q("insert into storage.objects(bucket_id,name)values('audio-playback',$1)",[playback]);
  await q("insert into private_audio.media_jobs(asset_id,variant_id,source_path,source_revision,status,input_bytes,output_bytes,duration_ms,processing_ms,cpu_ms,downloaded_bytes,uploaded_bytes)values($1,$2,$3,private_audio.source_revision($1),'completed',20000,$4,1000,10,5,20000,$4)",[asset,variant,source,bytes.length]);
  const service='fixture.'+Buffer.from(JSON.stringify({iss:'supabase-demo',role:'service_role'})).toString('base64url')+'.not-a-real-key';
  const cfg=gatewayConfig({UNIT_AUDIO_GATEWAY_DISPOSABLE:'yes',UNIT_AUDIO_DISPOSABLE:'yes',UNIT_TEST_SUPABASE_URL:'http://127.0.0.1:55421',
    UNIT_TEST_SUPABASE_SERVICE_ROLE_KEY:service,UNIT_AUDIO_GATEWAY_ORIGIN:'https://localhost:3000',UNIT_AUDIO_RATE_HMAC_KEY:newSecret(),UNIT_AUDIO_PROXY_HMAC_KEY:newSecret()});
  const transfers=[],logs=[],cookies=new Map();
  const fetchImpl=async(url,options)=>{
    if(!url.endsWith('/audio-playback/'+playback))throw new Error('Original or unregistered object requested');
    const range=options.headers.Range;
    const [start,end]=range?range.slice(6).split('-').map(Number):[0,bytes.length-1];
    const selected=bytes.subarray(start,end+1);transfers.push({start,end,bytes:selected.length});
    let offset=0;
    const body=new ReadableStream({pull(c){if(offset>=selected.length){c.close();return;}const n=selected.subarray(offset,offset+64);offset+=n.length;c.enqueue(n);}});
    return new Response(body,{status:range?206:200,headers:{'content-length':String(selected.length),'content-type':'audio/mpeg',
      ...(range?{'content-range':`bytes ${start}-${end}/${bytes.length}`}:{})}});
  };
  const runtime={cfg,delivery:controlledDelivery(cfg,fetchImpl),
    async user(token){if(token==='owner')return owner;if(token==='other')return other;if(token==='label')return label;throw new Error('Synthetic invalid Auth');},
    async rpc(name,args){return (await q(`select public.${name}(${Object.keys(args).map((k,i)=>k+' => $'+(i+1)).join(',')}) as v`,Object.values(args)))[0].v;},
  };
  function request(url,{method='POST',body,headers={},signed=true,origin=cfg.origin,ip='127.0.0.1',jar=true}={}) {
    const h=new Headers({'content-type':'application/json',origin,...headers});
    if(jar&&cookies.size)h.set('cookie',[...cookies].map(([k,v])=>k+'='+v).join('; '));
    const req=new Request(cfg.origin+url,{method,headers:h,...(body===undefined?{}:{body:JSON.stringify(body)})});
    if(signed){const time=String(Date.now());req.headers.set('x-unit-client-ip',ip);req.headers.set('x-unit-proxy-time',time);req.headers.set('x-unit-proxy-signature',proxySignature(req,ip,time,cfg.proxyKey));}
    return req;
  }
  async function call(operation,target,options={}) {
    const url=operation==='stream'?'/api/audio/stream/'+target:operation==='access'?'/api/audio/access':'/api/artist/audio/'+target;
    const res=await gateway(request(url,options),operation,target,runtime,e=>logs.push(e));
    for(const cookie of res.headers.getSetCookie()) {const [name,value]=cookie.split(';')[0].split('=');cookies.set(name,value);}
    return res;
  }
  async function create(body={},token='owner') {
    const res=await call('create',asset,{body,headers:{authorization:'Bearer '+token}});
    const value=await res.json();if(res.status!==201)throw new Error('Fixture create failed: '+JSON.stringify(value));
    return {...value,token:new URL(value.url).hash.slice(3)};
  }
  return {db,q,owner,other,label,asset,variant,source,playback,bytes,org,cfg,runtime,cookies,transfers,logs,request,call,create};
}
