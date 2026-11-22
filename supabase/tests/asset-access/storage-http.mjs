// RUN ONLY AGAINST A DISPOSABLE, FULL LOCAL SUPABASE STACK.
// No .env loading. A service key is used ONLY in this Node test for fixtures.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Upload } from 'tus-js-client';

const base = process.env.UNIT_TEST_SUPABASE_URL;
const anon = process.env.UNIT_TEST_SUPABASE_ANON_KEY;
const service = process.env.UNIT_TEST_SUPABASE_SERVICE_ROLE_KEY;
if (!base || !anon || !service || process.env.UNIT_DISPOSABLE_SUPABASE !== 'yes') {
  console.error('NOT RUN: supply explicit disposable-local URL, anon/service keys and UNIT_DISPOSABLE_SUPABASE=yes.');
  process.exit(2);
}
const parsed = new URL(base);
assert(['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname), 'Remote databases are forbidden');
assert(parsed.pathname === '/' && !parsed.search && !parsed.username && !parsed.password, 'Use a plain local API origin');
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(base, service, opts);
const clients = {};
const users = [];
const orgs = [];
const objectPaths = new Set();
const playbackPaths = new Set();
const tag = randomUUID();
const must = (result, step) => {
  assert(!result.error, `${step}: ${result.error?.message ?? ''}`);
  return result.data;
};
const forbidden = (result, step) => assert(result.error || !result.data, `${step} unexpectedly allowed`);
const bucket = c => c.storage.from('artist-files');
async function upload(c, name, bytes = Buffer.from('UNIT synthetic fixture')) {
  objectPaths.add(name);
  must(await bucket(c).upload(name, bytes, { contentType: name.endsWith('.png') ? 'image/png' : 'audio/wav' }), 'upload fixture');
}
async function absent(c, name, step) {
  forbidden(await bucket(c).download(name), step);
  forbidden(await bucket(c).createSignedUrl(name, 60), `${step}: new signed URL`);
}
try {
  for (const key of ['a','b','la','lb']) {
    const email = `unit-isolation-${tag}-${key}@example.invalid`;
    const password = randomBytes(24).toString('base64url');
    const created = must(await admin.auth.admin.createUser({ email, password, email_confirm: true,
      user_metadata: { artist_name: `Fixture ${key}`, role: key.startsWith('l') ? 'label' : 'artist' } }), 'create disposable user');
    users.push(created.user.id);
    const c = createClient(base, anon, opts);
    must(await c.auth.signInWithPassword({ email, password }), 'real local GoTrue login');
    clients[key] = { c, id: created.user.id };
  }
  const { a, b, la, lb } = clients;
  for (const label of [la, lb]) orgs.push(must(await label.c.rpc('create_label_org', { org_name: `Fixture ${tag}` }), 'create organization'));
  const root = `${a.id}/`;
  const original = `${root}audio/${tag}.wav`;
  let cover = `${root}photo/${tag}.png`;
  const neighbor = `${root}photo/${tag}-private.png`;
  const releaseCover = `${root}photo/${tag}-release.png`;
  await upload(a.c, original);
  await upload(a.c, cover);
  await upload(a.c, neighbor);
  await upload(a.c, releaseCover);
  const asset = must(await a.c.from('assets').insert({ owner_id: a.id, kind: 'audio', title: 'Private fixture', storage_path: original }).select().single(), 'register audio');
  const assetId = asset.id;
  must(await a.c.from('assets').update({ cover_path: cover, sort_order: -1, title: 'Renamed' }).eq('id', assetId), 'demo edits');
  cover = `${root}photo/${tag}-new-cover.png`;
  await upload(a.c, cover);
  must(await a.c.from('assets').update({ cover_path: cover }).eq('id', assetId).select().single(), 'owner cover replacement');
  await absent(la.c, original, 'independent artist vs label A');
  await absent(lb.c, original, 'independent artist vs label B');
  const artistA = must(await la.c.from('artists').insert({ org_id: orgs[0], user_id: a.id, stage_name: 'Fixture' }).select().single(), 'first artist relation');
  must(await lb.c.from('artists').insert({ org_id: orgs[1], user_id: a.id, stage_name: 'Fixture' }), 'second artist relation');
  await absent(la.c, original, 'two labels: still private A');
  await absent(lb.c, original, 'two labels: still private B');
  forbidden(await la.c.rpc('grant_asset_to_org', { p_asset_id: assetId, p_org_id: orgs[0], p_permission: 'manage' }), 'label self grant');
  forbidden(await b.c.rpc('grant_asset_to_org', { p_asset_id: assetId, p_org_id: orgs[0] }), 'artist B grant');
  must(await a.c.rpc('grant_asset_to_org', { p_asset_id: assetId, p_org_id: orgs[0], p_permission: 'view' }), 'owner grants A');
  must(await bucket(la.c).download(original), 'granted download');
  const signed = must(await bucket(la.c).createSignedUrl(original, 60), 'granted signed URL');
  assert.equal((await fetch(signed.signedUrl)).status, 200, 'actual signed URL fetch');
  const listing = must(await bucket(la.c).list(`${a.id}/photo`, { search: tag }), 'granted list');
  assert(listing.some(row => row.name === `${tag}-new-cover.png`));
  assert(!listing.some(row => row.name === `${tag}-private.png`));
  must(await bucket(la.c).download(cover), 'parent cover');
  await absent(la.c, neighbor, 'neighbor isolation');
  await absent(lb.c, original, 'grant not inherited by B');
  const deniedUpload = `${root}audio/${tag}-injected.wav`;
  objectPaths.add(deniedUpload);
  forbidden(await bucket(la.c).upload(deniedUpload, Buffer.from('no')), 'label upload into owner folder');
  forbidden(await bucket(la.c).update(original, Buffer.from('no')), 'label overwrite');
  const moved = `${root}audio/${tag}-moved.wav`;
  objectPaths.add(moved);
  forbidden(await bucket(la.c).move(original, moved), 'label move original');
  // Copies to own folder are inherently permitted by read + own upload.
  const copy = `${la.id}/audio/${tag}-copy.wav`;
  objectPaths.add(copy);
  must(await bucket(la.c).copy(original, copy), 'readable copy to own folder');
  const forbiddenCopy = `${lb.id}/audio/${tag}-copy.wav`;
  objectPaths.add(forbiddenCopy);
  forbidden(await bucket(lb.c).copy(original, forbiddenCopy), 'ungranted copy');
  await bucket(la.c).remove([original]); // Some Storage versions return [] instead of an error.
  must(await bucket(a.c).download(original), 'label delete leaves original intact');
  must(await a.c.rpc('revoke_asset_org_grant', { p_asset_id: assetId, p_org_id: orgs[0] }), 'revoke');
  await absent(la.c, original, 'revoked download/sign');
  await absent(la.c, cover, 'revoked cover');
  const oldResponse = await fetch(signed.signedUrl);
  console.log(`Observed old signed URL status after revocation: ${oldResponse.status} (expiry-based; not an instant-revoke guarantee).`);
  must(await a.c.rpc('grant_asset_to_org', { p_asset_id: assetId, p_org_id: orgs[0], p_permission: 'manage' }), 'manage grant');
  must(await la.c.from('assets').update({ title: 'Managed title' }).eq('id', assetId).select().single(), 'manage title');
  for (const patch of [{ owner_id: la.id }, { storage_path: original + '-forged' }, { org_id: orgs[1] }, { artist_id: artistA.id }]) {
    forbidden(await la.c.from('assets').update(patch).eq('id', assetId).select().single(), 'protected metadata');
  }
  const replacement = `${root}audio/${tag}-replacement.wav`;
  objectPaths.add(replacement);
  const session = must(await a.c.auth.getSession(), 'session');
  let sawProgress = false;
  await new Promise((resolve, reject) => {
    const task = new Upload(Buffer.from('UNIT synthetic TUS fixture'), {
      endpoint: `${base.replace(/\/$/,'')}/storage/v1/upload/resumable`,
      chunkSize: 6 * 1024 * 1024,
      headers: { authorization: `Bearer ${session.session.access_token}`, apikey: anon, 'x-upsert': 'false' },
      metadata: { bucketName: 'artist-files', objectName: replacement, contentType: 'audio/wav' },
      onProgress: () => { sawProgress = true; },
      onError: reject, onSuccess: resolve,
    });
    task.start();
  });
  assert(sawProgress, 'TUS progress callback');
  must(await a.c.from('assets').update({ storage_path: replacement, size_bytes: 26, mime_type: 'audio/wav' }).eq('id', assetId).select().single(), 'owner audio replacement');
  await absent(la.c, original, 'old path no longer shared');
  must(await bucket(la.c).download(replacement), 'replacement still explicitly shared');
  const release = must(await a.c.from('releases').insert({ owner_id: a.id, org_id: orgs[0], artist_id: artistA.id, title: 'Fixture release', cover_path: releaseCover }).select().single(), 'create release');
  must(await a.c.rpc('attach_asset_to_release', { p_asset_id: assetId, p_release_id: release.id, p_clean: true }), 'owner submits clean version');
  must(await bucket(la.c).download(releaseCover), 'registered release cover');
  const clean = must(await la.c.from('assets').select('id').eq('release_id', release.id).eq('is_clean_version', true), 'moderation query');
  assert(clean.some(row => row.id === assetId));
  await absent(lb.c, releaseCover, 'other label release cover');
  const guest = createClient(base, anon, opts);
  for (const c of [guest, lb.c]) {
    await absent(c, replacement, 'ungranted/anonymous original');
    const listed = await bucket(c).list(`${a.id}/audio`);
    assert(listed.error || !listed.data?.some(row => row.name.includes(tag)), 'ungranted list');
    forbidden(await bucket(c).upload(deniedUpload, Buffer.from('no')), 'ungranted upload into artist folder');
    forbidden(await bucket(c).update(replacement, Buffer.from('no')), 'ungranted update');
    forbidden(await bucket(c).move(replacement, moved), 'ungranted move');
    const destination = `${root}audio/${tag}-${randomUUID()}-copy.wav`;
    objectPaths.add(destination);
    forbidden(await bucket(c).copy(replacement, destination), 'ungranted copy');
    await bucket(c).remove([replacement]);
    must(await bucket(a.c).download(replacement), 'ungranted delete leaves original intact');
  }
  const playback = `${a.id}/${assetId}/${randomUUID()}.mp3`;
  playbackPaths.add(playback);
  must(await admin.storage.from('audio-playback').upload(playback, Buffer.from('synthetic playback'), { contentType: 'audio/mpeg' }), 'seed existing playback object');
  for (const c of [a.c, la.c, lb.c, guest]) {
    forbidden(await c.storage.from('audio-playback').download(playback), 'playback download denied');
    forbidden(await c.storage.from('audio-playback').createSignedUrl(playback, 60), 'playback signing denied');
  }
  // Owner direct Storage operations on an unregistered scratch object.
  const scratch = `${root}audio/${tag}-scratch.wav`;
  const scratchMoved = `${root}audio/${tag}-scratch-moved.wav`;
  const scratchCopy = `${root}audio/${tag}-scratch-copy.wav`;
  objectPaths.add(scratchMoved); objectPaths.add(scratchCopy);
  await upload(a.c, scratch);
  must(await bucket(a.c).update(scratch, Buffer.from('updated')), 'owner update');
  must(await bucket(a.c).move(scratch, scratchMoved), 'owner move');
  must(await bucket(a.c).copy(scratchMoved, scratchCopy), 'owner copy');
  must(await bucket(a.c).remove([scratchMoved, scratchCopy]), 'owner delete');
  must(await bucket(a.c).remove([replacement, cover]), 'owner demo cleanup');
  must(await a.c.from('assets').delete().eq('id', assetId).select().single(), 'owner demo deletion');
  console.log('PASS: real local Auth/PostgREST/Storage HTTP matrix, signed fetch, TUS, replacement, covers and release clean versions.');
} finally {
  // Only IDs generated by this run, on the explicitly acknowledged local instance.
  if (objectPaths.size) must(await admin.storage.from('artist-files').remove([...objectPaths]), 'cleanup fixture objects');
  if (playbackPaths.size) must(await admin.storage.from('audio-playback').remove([...playbackPaths]), 'cleanup playback fixtures');
  for (const id of orgs) must(await admin.from('organizations').delete().eq('id', id), 'cleanup organization');
  for (const id of users) must(await admin.auth.admin.deleteUser(id), 'cleanup user');
}
