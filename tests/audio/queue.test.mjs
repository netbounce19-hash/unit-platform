import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

test('full SQL replay: ownership, deduplication, fencing, publication, retry, cleanup', async () => {
  const { PGlite } = await import(process.env.UNIT_PGLITE_MODULE || '@electric-sql/pglite');
  const db = new PGlite();
  const owner = '10000000-0000-4000-8000-000000000001';
  const other = '10000000-0000-4000-8000-000000000002';
  const asset = '20000000-0000-4000-8000-000000000001';
  const worker = '30000000-0000-4000-8000-000000000001';
  const q = async (sql, params = []) => (await db.query(sql, params)).rows;
  const rpc = async (name, params = []) => (await q(`select public.${name}(${params.map((_, i) => '$'+(i+1)).join(',')}) as v`, params))[0].v;
  const identity = async (uid, role = 'authenticated') => {
    await db.exec('reset role');
    await q("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
    await db.exec(`set role ${role}`);
  };
  try {
    await db.exec(await readFile(new URL('../../supabase/tests/private-audio/bootstrap.sql', import.meta.url), 'utf8'));
    const migrations = new URL('../../supabase/migrations/', import.meta.url);
    for (const file of (await readdir(migrations)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file, migrations), 'utf8'));
    await q('insert into auth.users(id) values($1),($2)', [owner, other]);
    await q("insert into storage.objects(bucket_id,name) values('artist-files',$1)", [owner+'/audio/one.wav']);
    await q("insert into public.assets(id,owner_id,kind,storage_path) values($1,$2,'audio',$3)", [asset, owner, owner+'/audio/one.wav']);
    await identity(other);
    await assert.rejects(rpc('request_playback_variant', [asset]), /Only owner/);
    await assert.rejects(rpc('media_claim', [worker]), /permission denied/);
    await assert.rejects(q('select * from private_audio.media_jobs'), /permission denied/);
    await identity(owner);
    const first = await rpc('request_playback_variant', [asset]);
    assert.equal(first.status, 'pending');
    assert.deepEqual(await rpc('request_playback_variant', [asset]), first, 'same revision, same job');
    await identity('', 'service_role');
    const claim = await rpc('media_claim', [worker]);
    assert.equal(claim.attempt_count, 1);
    assert.equal(await rpc('media_claim', [worker]), null, 'no second active lease');
    const resolved = await rpc('media_resolve', [claim.id, claim.fence, 'a'.repeat(64), 100000, 10]);
    assert.equal(resolved.reused, false);
    const metrics = { output_sha256: 'b'.repeat(64), input_bytes: 100000, output_bytes: 25000,
      duration_ms: 1000, processing_ms: 40, cpu_ms: 20, downloaded_bytes: 125000, uploaded_bytes: 25000, strategy: 'transcode' };
    await assert.rejects(rpc('media_complete', [claim.id, claim.fence, metrics]), /OUTPUT_MISSING/);
    await db.exec('reset role');
    await q("update private_audio.media_jobs set locked_until=clock_timestamp()-interval '1 second' where id=$1", [claim.id]);
    await identity('', 'service_role');
    const newer = await rpc('media_claim', [worker]);
    assert.notEqual(newer.fence, claim.fence);
    await assert.rejects(rpc('media_heartbeat', [claim.id, claim.fence]), /LEASE_LOST/);
    await assert.rejects(rpc('media_complete', [claim.id, claim.fence, metrics]), /LEASE_LOST/);
    assert.equal(await rpc('media_fail', [claim.id, claim.fence, 'NETWORK_ERROR', true, 3]), false);
    const same = await rpc('media_resolve', [newer.id, newer.fence, 'a'.repeat(64), 100000, 15]);
    assert.equal(same.variant_id, resolved.variant_id);
    assert.equal(await rpc('media_fail',[newer.id,newer.fence,'STORAGE_UNAVAILABLE',true,3]),true);
    await db.exec('reset role');
    await q("update private_audio.media_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1",[newer.id]);
    await identity('', 'service_role');
    const recovered=await rpc('media_claim',[worker]);
    assert.equal(recovered.attempt_count,3);
    await rpc('media_resolve',[recovered.id,recovered.fence,'a'.repeat(64),100000,15]);
    await db.exec('reset role');
    await q("insert into storage.objects(bucket_id,name) values('audio-playback',$1)", [same.storage_path]);
    await identity('', 'service_role');
    assert.equal(await rpc('media_complete', [recovered.id, recovered.fence, metrics]), true);
    await identity(owner);
    assert.equal((await rpc('request_playback_variant', [asset])).status, 'completed');
    assert.equal((await rpc('request_playback_variant', [asset])).error_code,null,'successful recovery clears stale error');
    const cacheStart=performance.now();
    for(let i=0;i<50;i++) assert.equal((await rpc('request_playback_variant',[asset])).job_id,claim.id);
    console.log(JSON.stringify({event:'wasm_ready_request_benchmark',iterations:50,mean_ms:(performance.now()-cacheStart)/50,
      note:'PostgreSQL WASM, no HTTP/network; source Storage version fixture only'}));
    // A new object path with IDENTICAL actual hash reuses the variant.
    await db.exec('reset role');
    await q("insert into storage.objects(bucket_id,name) values('artist-files',$1)", [owner+'/audio/two.wav']);
    await identity(owner);
    await q('update public.assets set storage_path=$1 where id=$2', [owner+'/audio/two.wav', asset]);
    const next = await rpc('request_playback_variant', [asset]);
    assert.notEqual(next.job_id, first.job_id);
    await identity('', 'service_role');
    const nextClaim = await rpc('media_claim', [worker]);
    const cached = await rpc('media_resolve', [nextClaim.id, nextClaim.fence, 'a'.repeat(64), 100000, 4]);
    assert.equal(cached.reused, true);
    assert.equal(cached.variant_id, resolved.variant_id);
    // Replacement during an active job cannot publish the old source.
    await db.exec('reset role');
    await q("insert into storage.objects(bucket_id,name) values('artist-files',$1)", [owner+'/audio/three.wav']);
    await q('update public.assets set storage_path=$1 where id=$2', [owner+'/audio/three.wav', asset]);
    await identity(owner);
    await rpc('request_playback_variant', [asset]);
    await identity('', 'service_role');
    const changed = await rpc('media_claim', [worker]);
    await db.exec('reset role');
    await q('update public.assets set storage_path=$1 where id=$2', [owner+'/audio/two.wav', asset]);
    await identity('', 'service_role');
    await assert.rejects(rpc('media_resolve', [changed.id, changed.fence, 'c'.repeat(64), 1, 1]), /SOURCE_CHANGED/);
    assert.equal(await rpc('media_fail', [changed.id, changed.fence, 'SOURCE_CHANGED', false, 3]), true);
    // Completed metadata survives temporary failures; original never changed by worker.
    await db.exec('reset role');
    assert.equal((await q('select count(*)::int n from private_audio.audio_playback_variants'))[0].n, 1);
    assert.equal((await q('select status from private_audio.audio_playback_variants'))[0].status, 'ready');
    // Different bytes create a new UUID while the old ready version survives
    // until publication and dependency-checked cleanup.
    await q("insert into storage.objects(bucket_id,name) values('artist-files',$1)",[owner+'/audio/four.wav']);
    await q('update public.assets set storage_path=$1 where id=$2',[owner+'/audio/four.wav',asset]);
    await identity(owner);
    await rpc('request_playback_variant',[asset]);
    await identity('', 'service_role');
    const fresh=await rpc('media_claim',[worker]);
    const published=await rpc('media_resolve',[fresh.id,fresh.fence,'d'.repeat(64),100000,10]);
    assert.notEqual(published.variant_id,same.variant_id);
    await db.exec('reset role');
    assert.equal((await q('select cleanup_after from private_audio.audio_playback_variants where id=$1',[same.variant_id]))[0].cleanup_after,null);
    await q("insert into storage.objects(bucket_id,name) values('audio-playback',$1)",[published.storage_path]);
    await identity('', 'service_role');
    await rpc('media_complete',[fresh.id,fresh.fence,metrics]);
    await db.exec('reset role');
    await q('insert into private_audio.audio_share_links(asset_id,created_by,token_hash) values($1,$2,$3)',[asset,owner,'e'.repeat(64)]);
    await db.exec("update private_audio.media_cleanup set not_before=clock_timestamp()-interval '1 second'");
    await identity('', 'service_role');
    assert.equal(await rpc('media_cleanup_claim'),null,'active link conservatively pins old audio');
    await db.exec('reset role');
    await db.exec('update private_audio.audio_share_links set revoked_at=now()');
    await identity('', 'service_role');
    const oldCleanup=await rpc('media_cleanup_claim');
    assert.equal(oldCleanup.storage_path,same.storage_path);
    await rpc('media_cleanup_done',[oldCleanup.storage_path,oldCleanup.fence,true]);
    await db.exec('reset role');
    assert.equal((await q('select count(*)::int n from private_audio.audio_playback_variants where id=$1',[same.variant_id]))[0].n,0);
    assert.equal((await q('select status from private_audio.audio_playback_variants where id=$1',[published.variant_id]))[0].status,'ready');
    // Exact path tombstone survives cascade, and no metadata grants appear.
    await q('delete from public.assets where id=$1', [asset]);
    assert.equal((await q('select count(*)::int n from private_audio.media_jobs'))[0].n, 0);
    assert.equal((await q('select count(*)::int n from private_audio.media_cleanup where storage_path=$1',[published.storage_path]))[0].n,1);
    await q("update private_audio.media_cleanup set not_before=clock_timestamp()-interval '1 second' where storage_path=$1",[published.storage_path]);
    await identity('', 'service_role');
    const cleanup = await rpc('media_cleanup_claim');
    assert.equal(cleanup.storage_path, published.storage_path);
    assert.equal(await rpc('media_cleanup_done', [cleanup.storage_path, cleanup.fence, true]), true);
    assert.equal(await rpc('media_cleanup_claim'), null, 'tombstone is retained, rescheduled');
    // Three bounded retries, with a real due-time gate and no fourth claim.
    await db.exec('reset role');
    await q("insert into public.assets(id,owner_id,kind,storage_path) values($1,$2,'audio',$3)", [asset, owner, owner+'/audio/one.wav']);
    await identity(owner);
    await rpc('request_playback_variant', [asset]);
    await identity('', 'service_role');
    for (let attempt=1;attempt<=3;attempt++) {
      const retry = await rpc('media_claim', [worker]);
      assert.equal(retry.attempt_count, attempt);
      await rpc('media_fail', [retry.id,retry.fence,'STORAGE_UNAVAILABLE',true,3]);
      assert.equal(await rpc('media_claim',[worker]),null,'backoff is not immediate');
      await db.exec('reset role');
      const state=(await q('select status,next_attempt_at>clock_timestamp() delayed from private_audio.media_jobs where id=$1',[retry.id]))[0];
      assert.equal(state.status,attempt===3?'failed':'pending');
      assert.equal(state.delayed,true);
      await q("update private_audio.media_jobs set next_attempt_at=clock_timestamp()-interval '1 second' where id=$1",[retry.id]);
      await identity('', 'service_role');
    }
    assert.equal(await rpc('media_claim',[worker]),null);
    // A lower configured cap must survive crashes AND a different worker's
    // higher default, not only the graceful media_fail path.
    await db.exec('reset role');
    await q("insert into storage.objects(bucket_id,name) values('artist-files',$1)",[owner+'/audio/crash.wav']);
    await q('update public.assets set storage_path=$1 where id=$2',[owner+'/audio/crash.wav',asset]);
    await identity(owner);
    await rpc('request_playback_variant',[asset]);
    await identity('', 'service_role');
    const capped=await rpc('media_claim',[worker,1]);
    assert.equal(capped.max_attempts,1);
    await db.exec('reset role');
    await q("update private_audio.media_jobs set locked_until=clock_timestamp()-interval '1 second' where id=$1",[capped.id]);
    await identity('', 'service_role');
    assert.equal(await rpc('media_claim',[worker,3]),null);
  } finally { await db.close(); }
});
