import path from 'node:path';
import { tmpdir } from 'node:os';

export class MediaError extends Error {
  constructor(code, retry = false) { super(code); this.code = code; this.retry = retry; }
}
export function config(env = process.env) {
  const number = (key, fallback, min, max) => {
    const n = Number(env[key] ?? fallback);
    if (!Number.isFinite(n) || n < min || n > max) throw new MediaError('INVALID_CONFIG');
    return n;
  };
  for (const key of ['MAX_CONCURRENT_JOBS', 'MAX_JOB_ATTEMPTS', 'FFMPEG_THREADS']) {
    if (env[key] !== undefined && !Number.isInteger(Number(env[key]))) throw new MediaError('INVALID_CONFIG');
  }
  return Object.freeze({
    maxSource: number('MAX_SOURCE_SIZE_MB', 250, 0.001, 250) * 1e6,
    maxDuration: number('MAX_AUDIO_DURATION_MIN', 30, 0.001, 30) * 60,
    concurrency: number('MAX_CONCURRENT_JOBS', 1, 1, 2),
    attempts: number('MAX_JOB_ATTEMPTS', 3, 1, 3),
    idleMs: number('WORKER_IDLE_TIMEOUT', 60, 1, 3600) * 1000,
    runtimeMs: number('WORKER_MAX_RUNTIME', 600, 1, 3600) * 1000,
    jobMs: number('MAX_JOB_SECONDS', 300, 0.01, 600) * 1000,
    maxOutput: number('MAX_OUTPUT_SIZE_MB', 45, 0.001, 50) * 1e6,
    maxTemp: number('MAX_TEMP_SIZE_MB', 310, 1, 400) * 1e6,
    threads: number('FFMPEG_THREADS', 1, 1, 2),
    ffmpeg: env.FFMPEG_PATH || 'ffmpeg', ffprobe: env.FFPROBE_PATH || 'ffprobe',
    tempRoot: path.resolve(env.AUDIO_TEMP_ROOT || tmpdir()),
  });
}

// This PR deliberately cannot start a production worker. No override flag.
export function localCredentials(env = process.env) {
  if (env.UNIT_AUDIO_DISPOSABLE !== 'yes') throw new MediaError('DISPOSABLE_REQUIRED');
  let url;
  try { url = new URL(env.UNIT_TEST_SUPABASE_URL || 'http://invalid'); } catch { throw new MediaError('LOCAL_ONLY'); }
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.protocol !== 'http:' ||
    url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new MediaError('LOCAL_ONLY');
  const key = env.UNIT_TEST_SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new MediaError('LOCAL_KEY_REQUIRED');
  let claims;
  try { claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()); } catch { throw new MediaError('LOCAL_KEY_REQUIRED'); }
  // Never let a hosted project JWT be sent even to a local endpoint.
  if (claims.role !== 'service_role' || claims.ref || claims.iss !== 'supabase-demo') throw new MediaError('LOCAL_KEY_REQUIRED');
  return { base: url.origin, key };
}
