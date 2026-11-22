import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { config } from './config.mjs';
import { storage } from './storage.mjs';
import { processJob } from './processor.mjs';
import { assertResources } from './resources.mjs';
import { run } from './ffmpeg.mjs';
import { MediaError } from './config.mjs';

const cfg = config();
const io = storage(); // Fails closed before contacting any non-disposable URL.
await assertResources(cfg); // Real cgroup-v2 CPU/RAM/PID caps + bounded tmpfs.
for (const [binary, name] of [[cfg.ffmpeg, 'ffmpeg'], [cfg.ffprobe, 'ffprobe']]) {
  const version = (await run(binary, ['-version'])).output.split('\n')[0];
  if (!new RegExp(`^${name} version 9\\.1(?: |-)`).test(version)) throw new MediaError('ENCODER_VERSION_MISMATCH');
}
if (!(await run(cfg.ffmpeg, ['-encoders'])).output.includes('libmp3lame')) throw new MediaError('ENCODER_UNAVAILABLE');
const worker = randomUUID(), ctl = new AbortController();
const started = Date.now();
const continuous = process.argv.includes('--continuous');
const maxTimer = setTimeout(() => ctl.abort(), cfg.runtimeMs);
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => ctl.abort());
let idleSince = Date.now();
let cleanupDue = 0;
async function cleanupOne() {
  const item = await io.rpc('media_cleanup_claim', {}, ctl.signal);
  if (!item) return;
  let success = false;
  try { await io.remove(item.storage_path, ctl.signal); success = true; } catch {}
  await io.rpc('media_cleanup_done', { p_path: item.storage_path, p_fence: item.fence, p_success: success }, ctl.signal);
}
async function loop() {
  let idleDelay = 2000;
  while (!ctl.signal.aborted) {
    try {
      const job = await io.rpc('media_claim', { p_worker: worker, p_max_attempts: cfg.attempts }, ctl.signal);
      if (job) {
        idleSince = Date.now(); idleDelay = 2000;
        await processJob(job, io, cfg, ctl.signal);
        if (Date.now() >= cleanupDue && !ctl.signal.aborted) {
          cleanupDue = Date.now() + 60000;
          await cleanupOne();
        }
        continue;
      }
      await cleanupOne();
      if (!continuous && Date.now() - idleSince >= cfg.idleMs) break;
      await sleep(idleDelay + Math.floor(Math.random() * 1000), undefined, { signal: ctl.signal });
      idleDelay = Math.min(idleDelay * 2, 30000);
    } catch {
      if (!ctl.signal.aborted) {
        console.log(JSON.stringify({ event: 'media_worker_backoff', error_code: 'QUEUE_UNAVAILABLE' }));
        await sleep(15000, undefined, { signal: ctl.signal }).catch(() => {});
      }
    }
  }
}
try { await Promise.all(Array.from({ length: cfg.concurrency }, loop)); }
finally {
  clearTimeout(maxTimer);
  console.log(JSON.stringify({ event: 'media_worker_exit', elapsed_ms: Date.now() - started }));
}
