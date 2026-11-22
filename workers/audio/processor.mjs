import { mkdtemp, rm, statfs } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { convert } from './ffmpeg.mjs';
import { fileHash, validateJob } from './storage.mjs';
import { MediaError } from './config.mjs';

export async function processJob(job, io, cfg, parentSignal, logger = console.log) {
  validateJob(job);
  const started = performance.now();
  const ctl = new AbortController();
  const signal = AbortSignal.any([ctl.signal, AbortSignal.timeout(cfg.jobMs), ...(parentSignal ? [parentSignal] : [])]);
  let temp, heartbeatBusy = false, heartbeatError, input, output, variant, committed = false, transfer;
  const heartbeat = async () => {
    if (heartbeatBusy || signal.aborted) return;
    heartbeatBusy = true;
    try { await io.rpc('media_heartbeat', { p_job: job.id, p_fence: job.fence }, signal); }
    catch (e) { heartbeatError = e instanceof MediaError ? e : new MediaError('QUEUE_UNAVAILABLE', true); ctl.abort(); }
    finally { heartbeatBusy = false; }
  };
  const timer = setInterval(heartbeat, 20000);
  timer.unref();
  const report = (result, code) => logger(JSON.stringify({ event: 'media_job', job_id: job.id,
    attempt: job.attempt_count, result, error_code: code, input_bytes: input?.bytes ?? 0,
    output_bytes: output?.output_bytes ?? 0, duration_ms: output?.duration_ms ?? 0,
    elapsed_ms: Math.round(performance.now() - started), cpu_ms: output?.cpu_ms ?? 0,
    reused_variant: variant?.reused ?? false, strategy: output?.strategy,
    processing_ratio: output ? (performance.now()-started)/output.duration_ms : null,
    compression_ratio: output && input ? output.output_bytes/input.bytes : null }));
  try {
    if (cfg.maxSource + cfg.maxOutput > cfg.maxTemp) throw new MediaError('TEMP_BUDGET');
    const disk = await statfs(cfg.tempRoot);
    if (disk.bavail * disk.bsize < cfg.maxTemp + 16e6) throw new MediaError('DISK_FULL');
    temp = await mkdtemp(path.join(cfg.tempRoot, 'unit-audio-'));
    const source = path.join(temp, 'source'), target = path.join(temp, 'playback.mp3');
    input = await io.download(job, source, cfg.maxSource, signal);
    await heartbeat();
    if (heartbeatError) throw heartbeatError;
    variant = await io.rpc('media_resolve', { p_job: job.id, p_fence: job.fence, p_sha256: input.sha256,
      p_input_bytes: input.bytes, p_elapsed_ms: Math.round(performance.now()-started) }, signal);
    if (variant.reused) { committed = true; report('cache_hit'); return { reused: true }; }
    const expected = `${job.owner_id}/${job.asset_id}/${variant.variant_id}.mp3`;
    if (variant.storage_path !== expected) throw new MediaError('INVALID_OBJECT_PATH');
    output = await convert(source, target, cfg, signal);
    const sha = await fileHash(target);
    await heartbeat();
    if (heartbeatError) throw heartbeatError;
    transfer = await io.upload(expected, target, sha, cfg.maxOutput, signal);
    // Database publication is fenced. Storage alone is not a transaction.
    await io.rpc('media_complete', { p_job: job.id, p_fence: job.fence, p_metrics: {
      ...output, output_sha256: sha, input_bytes: input.bytes,
      processing_ms: Math.round(performance.now() - started),
      downloaded_bytes: input.bytes + transfer.verified, uploaded_bytes: transfer.uploaded,
    } }, signal);
    committed = true; report('completed');
    return { reused: false, ...output };
  } catch (error) {
    const e = heartbeatError || (signal.aborted ? new MediaError(parentSignal?.aborted ? 'WORKER_SHUTDOWN' : 'JOB_TIMEOUT') : error instanceof MediaError ? error :
      new MediaError(signal.aborted ? (parentSignal?.aborted ? 'WORKER_SHUTDOWN' : 'JOB_TIMEOUT') :
        error.code === 'ENOSPC' ? 'DISK_FULL' : error.code === 'ENOMEM' ? 'MEMORY_LIMIT' : 'WORKER_ERROR', false));
    // No immediate object delete: completion may have committed but its HTTP
    // response was lost, or a newer lease may own the same immutable object.
    try { await io.rpc('media_fail', { p_job: job.id, p_fence: job.fence, p_code: e.code,
      p_retry: e.retry || e.code === 'WORKER_SHUTDOWN', p_max_attempts: cfg.attempts,
      p_metrics: { processing_ms: Math.round(performance.now()-started),cpu_ms:output?.cpu_ms ?? 0,
        downloaded_bytes: (input?.bytes ?? 0)+(transfer?.verified ?? 0),uploaded_bytes:transfer?.uploaded ?? 0 } }); } catch {}
    report('failed', e.code);
    return { error: e.code };
  } finally {
    clearInterval(timer);
    ctl.abort();
    if (temp) await rm(temp, { recursive: true, force: true });
    // Suppress accidental retention of large object references.
    if (!committed) variant = undefined;
  }
}
