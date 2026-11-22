import { createClient } from '@supabase/supabase-js';
import { gatewayConfig, GatewayError } from './security.mjs';
import { controlledDelivery } from './delivery.mjs';

export function gatewayRuntime(env=process.env,fetchImpl=fetch) {
  const cfg=gatewayConfig(env);
  const client=createClient(cfg.base,cfg.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  return {cfg,delivery:controlledDelivery(cfg,fetchImpl),
    async user(bearer) {
      const {data,error}=await client.auth.getUser(bearer);
      if(error||!data.user)throw new GatewayError(401,'AUTH_REQUIRED');
      return data.user.id;
    },
    async rpc(name,args) {
      if(!/^audio_gateway_(admit|owner|access|issue|stream|release_crypto)$/.test(name))throw new GatewayError(500,'UNAVAILABLE');
      let response;
      try {
        response=await fetchImpl(`${cfg.base}/rest/v1/rpc/${name}`,{method:'POST',cache:'no-store',redirect:'error',
          headers:{apikey:cfg.key,authorization:`Bearer ${cfg.key}`,'content-type':'application/json'},
          body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});
        if(!response.ok){await response.body?.cancel();throw new Error();}
        return await response.json();
      } catch {throw new GatewayError(503,'UNAVAILABLE');}
    },
  };
}
