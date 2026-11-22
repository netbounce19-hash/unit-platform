// Fresh LOCAL Docker Supabase only. Never reads .env.local or links a project.
// Prerequisite: Docker Engine + Compose and Supabase CLI exactly 2.81.3.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const cli = process.env.UNIT_SUPABASE_CLI || 'supabase';
// Do not inherit hosted Supabase tokens, application keys or npm lifecycle env.
const env = Object.fromEntries(
  ['PATH', 'HOME', 'TMPDIR', 'SystemRoot', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG']
    .filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]])
);
function command(binary, args, cwd, extra = {}) {
  const result = spawnSync(binary, args, {
    cwd, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...extra,
  });
  // Never print CLI status, container env, passwords or service credentials.
  if (result.error || result.status !== 0) {
    throw new Error(`${path.basename(binary)} ${args[0]} failed (exit ${result.status ?? 'unavailable'}); inspect the local prerequisite, not production`);
  }
  return result.stdout;
}
async function assertFree(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`Local port ${port} is occupied; no existing service was changed`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}

let scratch;
let project;
let started = false;
try {
  if (env.DOCKER_HOST) assert(env.DOCKER_HOST.startsWith('unix://'), 'Remote Docker hosts are forbidden');
  const context = JSON.parse(command('docker', ['context', 'inspect']))[0];
  const host = env.DOCKER_HOST || context.Endpoints?.docker?.Host;
  assert(host?.startsWith('unix://'), 'Use a local Unix-socket Docker Engine, not a remote daemon');
  command('docker', ['info', '--format', '{{.ServerVersion}}']);
  command('docker', ['compose', 'version']);
  assert.equal(command(cli, ['--version']).trim(), '2.81.3', 'Use the reviewed CLI version');
  for (const port of [55420, 55421, 55422, 55423, 55424]) await assertFree(port);
  scratch = await mkdtemp(path.join(tmpdir(), 'unit-pr12-local-'));
  project = `unit-pr12-${randomUUID().slice(0, 8)}`;
  await mkdir(path.join(scratch, 'supabase', 'migrations'), { recursive: true });
  const files = (await readdir(path.join(root, 'supabase/migrations'))).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) await copyFile(path.join(root, 'supabase/migrations', file), path.join(scratch, 'supabase/migrations', file));
  await writeFile(path.join(scratch, 'supabase/config.toml'), `project_id = "${project}"
[api]
enabled = true
port = 55421
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000
[db]
port = 55422
shadow_port = 55420
major_version = 17
[db.pooler]
enabled = false
[studio]
enabled = false
port = 55423
[inbucket]
enabled = false
port = 55424
[storage]
enabled = true
file_size_limit = "50MiB"
[auth]
enabled = true
site_url = "http://localhost:3000"
enable_signup = true
[auth.email]
enable_signup = true
enable_confirmations = false
[analytics]
enabled = false
[edge_runtime]
enabled = false
[realtime]
enabled = false
`);
  // Set before invocation so a partial start is also cleaned up.
  started = true;
  command(cli, ['start', '-x', 'imgproxy,studio,mailpit,realtime,postgres-meta,edge-runtime,logflare,vector,supavisor'], scratch);
  const status = JSON.parse(command(cli, ['status', '-o', 'json'], scratch));
  const api = new URL(status.API_URL);
  assert(['127.0.0.1', 'localhost'].includes(api.hostname) && api.port === '55421', 'Unexpected disposable origin');
  assert(status.ANON_KEY && status.SERVICE_ROLE_KEY, 'Local status must include local fixture keys');
  const actual = JSON.parse(command('docker', ['exec', `supabase_db_${project}`, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-Atc',
    "select coalesce(json_agg(json_build_object('version',version,'name',name) order by version),'[]') from supabase_migrations.schema_migrations"], scratch));
  const expected = files.map(f => ({ version: f.split('_')[0], name: f.slice(15, -4) }));
  assert.deepEqual(actual, expected, 'Actual migration ledger must match every copied file');
  console.log(`PASS: fresh local Supabase migration history (${files.length} files)`);
  command(process.execPath, [path.join(root, 'supabase/tests/asset-access/storage-http.mjs')], root, {
    env: { ...env, UNIT_DISPOSABLE_SUPABASE: 'yes', UNIT_TEST_SUPABASE_URL: status.API_URL,
      UNIT_TEST_SUPABASE_ANON_KEY: status.ANON_KEY, UNIT_TEST_SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY },
    stdio: 'inherit',
  });
} catch (error) {
  console.error(`BLOCKED/FAIL: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (started) {
    try {
      command(cli, ['stop', '--project-id', project, '--no-backup'], scratch);
    } catch {
      console.error(`Cleanup failed: run the pinned CLI stop --project-id ${project} --no-backup from ${scratch}`);
      process.exitCode = 1;
      // Preserve local recovery context, never silently abandon running volumes.
      scratch = undefined;
    }
  }
  if (scratch) await rm(scratch, { recursive: true, force: true });
}
