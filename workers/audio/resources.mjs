import { readFile, statfs } from 'node:fs/promises';
import path from 'node:path';
import { MediaError } from './config.mjs';

/** The daemon/batch entry point requires actual kernel limits, not an env ack.
 * Pure processor tests may run on macOS with synthetic short fixtures only.
 */
export async function assertResources(cfg) {
  try {
    if (process.platform !== 'linux') throw new Error();
    const group=(await readFile('/proc/self/cgroup','utf8')).split('\n').find(s=>s.startsWith('0::'))?.slice(3);
    if (!group || group.split('/').includes('..')) throw new Error();
    const root=path.join('/sys/fs/cgroup',group);
    const memory=Number((await readFile(path.join(root,'memory.max'),'utf8')).trim());
    const swap=Number((await readFile(path.join(root,'memory.swap.max'),'utf8')).trim());
    const pids=Number((await readFile(path.join(root,'pids.max'),'utf8')).trim());
    const [quota,period]=(await readFile(path.join(root,'cpu.max'),'utf8')).trim().split(/\s+/).map(Number);
    const disk=await statfs(cfg.tempRoot);
    if (!(memory>0 && memory<=805306368 && swap===0 && pids>0 && pids<=64 && quota>0 && period>0 && quota/period<=2 &&
      disk.type===0x01021994 && disk.blocks*disk.bsize<=cfg.maxTemp*cfg.concurrency*1.25)) throw new Error();
  } catch { throw new MediaError('RESOURCE_LIMITS_REQUIRED'); }
}
