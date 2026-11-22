import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { MediaError } from './config.mjs';

export function run(binary, args, { signal, timeoutMs = 30000, maxBytes = 262144 } = {}) {
  return new Promise((resolve, reject) => {
    let output = '', bytes = 0, terminal, cpuMs = 0;
    // No shell, inherited credentials or user-controlled filenames/URLs.
    const child = spawn(binary, args, { env: { PATH: process.env.PATH, LC_ALL: 'C' }, stdio: ['ignore', 'pipe', 'pipe'] });
    const stop = code => { terminal ||= code; child.kill('SIGKILL'); };
    const abort = () => stop('JOB_CANCELLED');
    const timer = setTimeout(() => stop('PROCESS_TIMEOUT'), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout.on('data', b => { bytes += b.length; if (bytes > maxBytes) stop('PROCESS_OUTPUT_LIMIT'); else output += b; });
    // Drain but never retain/log private filenames or arbitrary decoder messages.
    child.stderr.on('data', b => {
      const m = b.toString().match(/utime=([\d.]+)s stime=([\d.]+)s/);
      if (m) cpuMs = Math.round((Number(m[1]) + Number(m[2])) * 1000);
    });
    child.once('error', () => { terminal ||= 'PROCESS_UNAVAILABLE'; });
    child.once('close', (code, sig) => {
      clearTimeout(timer); signal?.removeEventListener('abort', abort);
      if (terminal || code !== 0) reject(new MediaError(terminal || (sig === 'SIGKILL' ? 'PROCESS_KILLED' : 'INVALID_MEDIA')));
      else resolve({ output, cpuMs });
    });
  });
}

const protocols = ['-protocol_whitelist', 'file,pipe'];
export async function probe(file, cfg, signal) {
  const { output } = await run(cfg.ffprobe, ['-v', 'error', ...protocols, '-max_alloc', '67108864',
    '-show_entries', 'format=format_name,duration,bit_rate:stream=codec_type,codec_name,sample_rate,channels,duration,bit_rate',
    '-of', 'json', file], { signal, timeoutMs: Math.min(cfg.jobMs, 30000) });
  let data;
  try { data = JSON.parse(output); } catch { throw new MediaError('INVALID_MEDIA'); }
  const audio = data.streams?.filter(s => s.codec_type === 'audio') || [];
  const allowed = ['wav', 'flac', 'aiff', 'mp3'];
  if (!allowed.includes(data.format?.format_name) || audio.length !== 1) throw new MediaError('UNSUPPORTED_MEDIA');
  const stream = audio[0];
  if (!(stream.codec_name === 'flac' || stream.codec_name === 'mp3' || stream.codec_name?.startsWith('pcm_'))) throw new MediaError('UNSUPPORTED_CODEC');
  const seconds = Number(data.format.duration);
  if (!Number.isFinite(seconds) || seconds <= 0) throw new MediaError('INVALID_DURATION');
  if (seconds > cfg.maxDuration) throw new MediaError('DURATION_LIMIT');
  return { seconds, format: data.format.format_name, ...stream };
}

export async function convert(input, output, cfg, signal) {
  const source = await probe(input, cfg, signal);
  // 192k nominal stream bitrate; higher/lower rates are transcoded to bound storage.
  // Remux strips tags/artwork without decoding/re-encoding eligible frames.
  const copy = source.format === 'mp3' && source.codec_name === 'mp3' &&
    Number(source.sample_rate) === 44100 && source.channels === 2 && Number(source.bit_rate) === 192000;
  const args = ['-nostdin', '-hide_banner', '-v', 'error', '-benchmark', '-xerror', ...protocols,
    '-max_alloc', '67108864', '-threads', String(cfg.threads), '-i', input, '-map', '0:a:0',
    '-vn', '-sn', '-dn', '-map_metadata', '-1', '-map_chapters', '-1',
    ...(copy ? ['-c:a', 'copy'] : ['-c:a', 'libmp3lame', '-b:a', '192k', '-ar', '44100', '-ac', '2', '-threads', String(cfg.threads)]),
    '-id3v2_version', '0', '-write_id3v1', '0', '-fs', String(cfg.maxOutput), '-f', 'mp3', '-n', output];
  // Info logging is needed ONLY for machine-parsed FFmpeg CPU benchmark line.
  args[3] = 'info';
  const result = await run(cfg.ffmpeg, args, { signal, timeoutMs: cfg.jobMs });
  const size = (await stat(output)).size;
  if (!size || size >= cfg.maxOutput) throw new MediaError('OUTPUT_LIMIT');
  const target = await probe(output, cfg, signal);
  if (target.format !== 'mp3' || Number(target.sample_rate) !== 44100 || target.channels !== 2 ||
    Math.abs(target.seconds - source.seconds) > 0.15) throw new MediaError('INVALID_OUTPUT');
  // Full decode catches truncated/corrupt frames; no loudness or dynamics filters.
  const decode = await run(cfg.ffmpeg, ['-nostdin', '-hide_banner', '-v', 'info', '-benchmark', '-xerror', ...protocols,
    '-max_alloc', '67108864', '-threads', String(cfg.threads), '-i', output, '-map', '0:a:0', '-f', 'null', '-'],
  { signal, timeoutMs: cfg.jobMs });
  return { duration_ms: Math.round(target.seconds * 1000), output_bytes: size,
    strategy: copy ? 'stream_copy' : 'transcode', cpu_ms: result.cpuMs + decode.cpuMs };
}
