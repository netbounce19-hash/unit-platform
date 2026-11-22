import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { MediaError, localCredentials } from './config.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function validateJob(job) {
  if (![job.id, job.asset_id, job.owner_id, job.fence].every(v => typeof v === 'string' && uuid.test(v))) throw new MediaError('INVALID_JOB');
  const parts = job.source_path?.split('/');
  if (parts?.length !== 3 || parts[0] !== job.owner_id || parts[1] !== 'audio' ||
    !parts[2] || ['.', '..'].includes(parts[2]) || /[\\\0]/.test(job.source_path)) throw new MediaError('INVALID_JOB');
}
export function validatePlayback(value) {
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.mp3$/.test(value)) throw new MediaError('INVALID_OBJECT_PATH');
}
export async function fileHash(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function streamHash(response, limit, signal, file) {
  if (!response.body) throw new MediaError('STORAGE_UNAVAILABLE', true);
  if (Number(response.headers.get('content-length')) > limit) { await response.body.cancel(); throw new MediaError('SOURCE_SIZE_LIMIT'); }
  let bytes = 0;
  const hash = createHash('sha256');
  const count = new Transform({ transform(chunk, encoding, callback) {
    bytes += chunk.length;
    if (bytes > limit) return callback(new MediaError('SOURCE_SIZE_LIMIT'));
    hash.update(chunk); callback(null, chunk);
  } });
  if (file) await pipeline(Readable.fromWeb(response.body), count, createWriteStream(file, { flags: 'wx', mode: 0o600 }), { signal });
  else await pipeline(Readable.fromWeb(response.body), count,
    new Writable({ write(_chunk, _encoding, callback) { callback(); } }), { signal });
  if (!bytes) throw new MediaError('EMPTY_SOURCE');
  return { bytes, sha256: hash.digest('hex') };
}

export function storage(env = process.env, fetchImpl = fetch) {
  const { base, key } = localCredentials(env);
  const headers = { apikey: key, authorization: `Bearer ${key}` };
  async function request(url, options = {}, signal) {
    try {
      return await fetchImpl(base + url, { ...options, headers: { ...headers, ...options.headers },
        redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(30000), ...(signal ? [signal] : [])]) });
    } catch { throw new MediaError(signal?.aborted ? 'JOB_CANCELLED' : 'STORAGE_UNAVAILABLE', !signal?.aborted); }
  }
  const objectUrl = (bucket, name) => `/storage/v1/object/${bucket}/${name.split('/').map(encodeURIComponent).join('/')}`;
  function httpError(res) {
    return new MediaError(res.status === 404 ? 'SOURCE_MISSING' : 'STORAGE_UNAVAILABLE', res.status === 429 || res.status >= 500);
  }
  async function receive(res, limit, signal, file) {
    try { return await streamHash(res, limit, signal, file); }
    catch (e) {
      if (e instanceof MediaError) throw e;
      if (e.code === 'ENOSPC') throw new MediaError('DISK_FULL');
      if (e.code === 'ENOMEM') throw new MediaError('MEMORY_LIMIT');
      if (['EACCES','EROFS','ENOENT','EEXIST'].includes(e.code)) throw new MediaError('LOCAL_IO_ERROR');
      throw new MediaError(signal?.aborted ? 'JOB_CANCELLED' : 'STORAGE_UNAVAILABLE', !signal?.aborted);
    }
  }
  return {
    async rpc(name, args = {}, signal) {
      if (!/^media_(claim|heartbeat|resolve|complete|fail|cleanup_claim|cleanup_done)$/.test(name)) throw new MediaError('INVALID_RPC');
      const res = await request(`/rest/v1/rpc/${name}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(args) }, signal);
      if (!res.ok) {
        let message = '', dbCode = '';
        try { const data = await res.json(); message = data.message; dbCode = data.code; } catch {}
        const known = ['LEASE_LOST','SOURCE_CHANGED','VARIANT_BUSY','VARIANT_RETIRED','OUTPUT_MISSING','UNQUALIFIED_VARIANT'];
        const code = known.find(c => message === c);
        if (['40001','40P01','55P03','57014','53300'].includes(dbCode)) throw new MediaError('QUEUE_BUSY', true);
        throw code ? new MediaError(code, ['VARIANT_BUSY','VARIANT_RETIRED'].includes(code)) : httpError(res);
      }
      return res.json();
    },
    async download(job, file, limit, signal) {
      validateJob(job);
      const res = await request(objectUrl('artist-files', job.source_path), {}, signal);
      if (!res.ok) { await res.body?.cancel(); throw httpError(res); }
      return receive(res, limit, signal, file);
    },
    async upload(name, file, expectedHash, limit, signal) {
      validatePlayback(name);
      const size = (await stat(file)).size;
      if (!size || size > limit) throw new MediaError('OUTPUT_LIMIT');
      const body = createReadStream(file);
      let res;
      try {
        res = await request(objectUrl('audio-playback', name), { method: 'POST', headers: {
          'content-type': 'audio/mpeg', 'content-length': String(size), 'x-upsert': 'false', 'cache-control': 'private, max-age=0',
        }, body, duplex: 'half' }, signal);
      } finally { body.destroy(); }
      if (res.ok) { await res.body?.cancel(); return { uploaded: size, verified: 0 }; }
      if (res.status !== 409 && res.status !== 400) { await res.body?.cancel(); throw httpError(res); }
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        if (!['Duplicate', 'Asset Already Exists'].includes(error.error) && error.statusCode !== '409' && error.code !== 'Duplicate') throw httpError(res);
      }
      // Immutable put + byte verification, including a collision left by a dead
      // lease. Never overwrite/delete another attempt's canonical result.
      const check = await request(objectUrl('audio-playback', name), {}, signal);
      if (!check.ok) { await check.body?.cancel(); throw httpError(check); }
      const actual = await receive(check, limit, signal);
      if (actual.sha256 !== expectedHash || actual.bytes !== size) throw new MediaError('OUTPUT_COLLISION');
      return { uploaded: 0, verified: actual.bytes };
    },
    async remove(name, signal) {
      validatePlayback(name);
      const res = await request('/storage/v1/object/audio-playback', {
        method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: [name] }),
      }, signal);
      await res.body?.cancel();
      if (!res.ok) throw httpError(res);
    },
  };
}
