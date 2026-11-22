import { hash, verify, Algorithm } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';
import { GatewayError } from './security.mjs';

// Public dummy hash only. Same fixed KDF cost for nonexistent/revoked/wrong-PIN.
const dummy='$argon2id$v=19$m=65536,t=3,p=1$VU5JVGR1bW15U2FsdDAwMQ$FjmtfTMCem+BXMEk5RkzOtdBry8M+64mW4M0rXxZ0RE';
const qualified=/^\$argon2id\$v=19\$m=65536,t=3,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/;
export const validPin=value=>typeof value==='string' && /^\d{6,8}$/.test(value);
let active=0;
async function slot(fn) {
  // Additional per-instance memory cap. PostgreSQL leases/rates are the shared
  // authority; this counter is NEVER the sole rate limiter.
  if(active>=2)throw new GatewayError(429,'RATE_LIMITED');
  active++;
  try{return await fn();}finally{active--;}
}
export async function hashPin(pin) {
  if(!validPin(pin))throw new GatewayError(400,'INVALID_REQUEST');
  return slot(()=>hash(pin,{algorithm:Algorithm.Argon2id,memoryCost:65536,timeCost:3,parallelism:1,outputLen:32,salt:randomBytes(16)}));
}
export async function verifyPin(encoded,pin) {
  const usable=typeof encoded==='string' && qualified.test(encoded);
  const valid=validPin(pin);
  const match=await slot(async()=>{
    try{return await verify(usable?encoded:dummy,valid?pin:'invalid PIN');}
    catch{await verify(dummy,'invalid PIN');return false;}
  });
  return usable && valid && match;
}
