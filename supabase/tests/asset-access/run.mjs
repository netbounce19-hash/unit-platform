// Disposable SQL test only. No .env, credentials, or remote connections.
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const { PGlite } = await import(process.env.UNIT_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const target = '20261122111038_asset_access_isolation.sql';
try {
  await db.exec(await readFile(new URL('../private-audio/bootstrap.sql', import.meta.url), 'utf8'));
  const files = (await readdir(path.join(root, 'supabase/migrations'))).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (file === target) {
      // Prove the PR 1 security model before hardening changes its legacy-risk assertions.
      await db.exec(await readFile(new URL('../private-audio/access.sql', import.meta.url), 'utf8'));
      await db.exec(await readFile(new URL('legacy-fixtures.sql', import.meta.url), 'utf8'));
      await db.exec('create temp table before_hardening as select id,to_jsonb(a) snapshot from public.assets a');
    }
    await db.exec(await readFile(path.join(root, 'supabase/migrations', file), 'utf8'));
    console.log(`Applied locally: ${file}`);
  }
  const { rows } = await db.query(`select bool_and(s.snapshot=to_jsonb(a)) preserved from before_hardening s join public.assets a using(id)`);
  if (!rows[0].preserved) throw new Error('Migration modified existing assets');
  const missing = await db.query('select count(*) n from before_hardening s where not exists(select 1 from public.assets a where a.id=s.id)');
  if (Number(missing.rows[0].n) !== 0) throw new Error('Migration deleted existing assets');
  console.log('PASS: every existing asset field and ID preserved, including covers and paths.');
  for (const result of await db.exec(await readFile(new URL('access.sql', import.meta.url), 'utf8'))) {
    for (const row of result.rows ?? []) if (row.result) console.log(row.result);
  }
  await db.exec(`select set_config('request.jwt.claim.sub','',false);
    insert into public.asset_org_grants(asset_id,org_id,granted_by,permission,revoked_at)
    values(md5('legacy-revoked')::uuid,md5('legacy-org')::uuid,md5('legacy-owner')::uuid,'view',now());`);
  // Read-only operations report, then separately approved backfill on synthetic data.
  await db.exec(await readFile(path.join(root,'supabase/operations/asset-access/dry-run.sql'),'utf8'));
  const script = (await readFile(path.join(root,'supabase/operations/asset-access/backfill.sql'),'utf8')).split('begin;')[1];
  await db.exec('begin;' + script);
  const check = await db.query(`select count(*) n from public.asset_org_grants where grant_source='backfill'`);
  if (Number(check.rows[0].n) !== 1) throw new Error('Backfill must issue exactly one unambiguous release grant');
  await db.exec('begin;' + script);
  const twice = await db.query(`select count(*) n from public.asset_org_grants where grant_source='backfill'`);
  if (Number(twice.rows[0].n) !== 1) throw new Error('Backfill is not idempotent');
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub',md5('legacy-label')::uuid::text,false);`);
  const allowed = await db.query(`select name from storage.objects where bucket_id='artist-files' order by name`);
  if (allowed.rows.length !== 3) throw new Error('Backfilled label must see exactly original, its demo cover and registered release cover');
  await db.exec('reset role');
  console.log('PASS: dry-run and conservative/idempotent backfill, no private/conflicting/revoked grants restored.');
  console.log('PASS: SQL isolation suite (PostgreSQL WASM; not Supabase HTTP).');
} finally { await db.close(); }
