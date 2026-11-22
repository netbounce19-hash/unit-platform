// Disposable PostgreSQL WASM runner; no environment files or remote connections.
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const moduleName = process.env.UNIT_PGLITE_MODULE || '@electric-sql/pglite';
const { PGlite } = await import(moduleName);
const db = new PGlite();
try {
  await db.exec(await readFile(new URL('bootstrap.sql', import.meta.url), 'utf8'));
  const files = (await readdir(path.join(root, 'supabase/migrations'))).filter(f => f.endsWith('.sql')).sort();
  const target = '20261122101423_private_audio_db_security.sql';
  for (const file of files) {
    if (file === target) {
      await db.exec(`
        insert into auth.users(id,email) values ('11111111-1111-4111-8111-111111111111','legacy@example.invalid');
        insert into public.assets(id,owner_id,kind,title,storage_path)
        values ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','audio','Existing demo','11111111-1111-4111-8111-111111111111/audio/demo.mp3');
        create temp table legacy_asset_snapshot as select to_jsonb(a) as row from public.assets a;
      `);
    }
    await db.exec(await readFile(path.join(root, 'supabase/migrations', file), 'utf8'));
    console.log(`Applied locally: ${file}`);
  }
  const preservation = await db.query(`
    select (to_jsonb(a) - 'track_type' - 'visibility' - 'download_enabled') = s.row as intact,
      a.visibility = 'private' and a.track_type = 'demo' and not a.download_enabled as defaults_ok
    from public.assets a cross join legacy_asset_snapshot s
    where a.id = '22222222-2222-4222-8222-222222222222'
  `);
  if (preservation.rows.length !== 1 || !preservation.rows[0].intact || !preservation.rows[0].defaults_ok) {
    throw new Error('Existing demo was modified by the new migration');
  }
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);`);
  const demos = await db.query(`select * from public.assets where kind='audio' and release_id is null order by sort_order asc nulls last, created_at desc`);
  if (!demos.rows.some(r => r.id === '22222222-2222-4222-8222-222222222222')) throw new Error('Existing demo SELECT no longer works');
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false);`);
  console.log('PASS: existing demo fields preserved and existing demo query remains readable.');
  const results = await db.exec(await readFile(new URL('access.sql', import.meta.url), 'utf8'));
  for (const result of results) {
    for (const row of result.rows ?? []) {
      if (row.result) console.log(row.result);
    }
  }
  console.log('PASS: historical migration replay + private audio SQL access tests (PostgreSQL WASM).');
} finally {
  await db.close();
}
