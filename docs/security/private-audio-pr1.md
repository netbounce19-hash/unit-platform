# PR 1 — Private music player: database and security

## Scope and status

Only additive database/security work. No UI, token-generation API, streaming,
transcoding, public endpoints, or production migration. Branch:
`feat/private-audio-db-security`.

Migration: `supabase/migrations/20261122101423_private_audio_db_security.sql`
(created with Supabase CLI 2.81.3). The 19 historical migrations are unchanged.
Existing deployment-preparation files in the worktree are outside this PR.

## Read-only audit

Reviewed AGENTS.md, package.json, uploads.ts, demos.ts, client.ts,
DemoContext.tsx, all historical migrations, and label asset queries.

On 2026-11-22 the connected project inventory reported UNIT / Unit Creative
(`nxdbpaayojzesezhcskb`) as INACTIVE. Listing applied migrations timed out.
The Security Advisors call returned an empty list, but that is NOT evidence
that an inactive project's deployed schema is secure. No other project's
schema was inspected. Actual applied migrations/policies are unverified.
No production SQL was executed. No environment values were printed.

## Implemented data model

- `public.assets`: additive track_type (demo default), visibility (private
  default), download_enabled (false default), enumerated CHECKs. No old ID,
  owner, artist, organization, release, title or path is rewritten.
- `private_audio.audio_playback_variants`: audio FK, canonical MP3 path,
  SHA-256 source fingerprint, format/size/duration checks, status transitions'
  data invariants, work index and one variant per asset/source/codec.
- `private_audio.audio_share_links`: independent links per asset, unique
  SHA-256/HMAC-SHA-256 digest representation (64 lowercase hex), owner creator,
  nullable expiry, revocation. Link mode forbids PIN hash; PIN mode requires
  encoded Argon2id/bcrypt hash. Database checks the encoding, NOT its
  cryptographic quality: PR 2+ must use a real adaptive hasher and CSPRNG.
- `private_audio.audio_playback_sessions`: hashed secret, 30-minute maximum
  lifetime, expiry capped by parent, parent-row locking, no resurrection or
  extension. Link token/PIN/mode/expiry/revocation changes revoke all sessions.
- `private_audio.audio_play_events`: composite session/link FK, event enums,
  nonnegative position, nonce uniqueness per link, partial unique index for
  one qualified play per session. Non-page events require a session.
- Audio-only references enforced with trigger + FK. Changing referenced
  asset identity/kind/owner is blocked. Asset deletion cascades DB records.
- A narrow trigger prevents non-owner clients from changing the three new
  publication columns even if old org UPDATE access permits other edits.

No use of my_artist_id(), my_org_id(), or org membership for new permissions.
The tests link the same user to two organizations deliberately.

## Access boundary

All four internal tables have RLS and no PUBLIC/anon/authenticated/service_role
schema/table grants. `private_audio` must remain OUTSIDE exposed API schemas.
Browser roles cannot read hashes (even select('*')), sessions, events or paths,
nor write internal records. There is no anonymous INSERT policy.

`public.audio_share_link_metadata` is the sole client-readable projection:
explicit safe columns, `security_barrier=true`, explicit
`assets.owner_id = auth.uid()` predicate. It is deliberately an OWNER-executed
view: a security_invoker view would require granting underlying secret-table
access. Its owner is the trusted migration role; do not transfer ownership to
an untrusted role. This exception may be reported by a view-definer advisor
and must be reviewed as an intentional safe projection, not blindly changed.
No browser writes to the view are granted. New link management is reserved for
an owner-authorized server operation in a later PR; this PR supplies no such API.

`unit_audio_backend` is NOLOGIN, NOINHERIT, NOBYPASSRLS and is not granted to
anyone (including authenticator). Explicit backend RLS policies and grants
allow internal DB operations plus Storage CRUD only on registered canonical
playback paths. It cannot use those policies to read artist-files. Future
server provisioning must use a dedicated credential and validate the requesting
owner via assets.owner_id before management writes. The role itself is a trusted
cross-owner worker capability, NOT a safe role for a browser JWT. Do not grant
it to authenticated, anon or authenticator. No credential is created here.

Storage bucket `audio-playback` is private. Restrictive ALL policies deny
anon/authenticated every playback operation even if an unrelated permissive
policy later says true. Backend restrictive policy confines it to this bucket;
a permissive policy additionally requires a registered canonical variant path.
Superusers/storage administrators can bypass RLS; database policy cannot
constrain a superuser or a leaked broad service credential. Keep those outside
the request path and outside client environment variables.

## Security findings — existing originals are NOT isolated

### HIGH: automatic cross-label access to originals (open)

`20260730000000_label_cabinet.sql`:
- assets: select own or org allows any linked label member to SELECT every
  asset owned by that artist, even with org_id=NULL and release_id=NULL.
- can_access_user_folder returns true for any artist↔label membership match.
- artist-files: select owner or org uses only the top-level user folder.

Consequently BOTH Label A and Label B can read a personal unreleased original
and obtain a signed download URL with no per-asset grant. visibility='private'
and download_enabled=false do not override these policies. Local tests
explicitly reproduce this finding; those assertions are not isolation claims.

Not changed blindly: fetchArtistAssets(userId), label file cards, moderation,
release assets and signed URLs currently depend on that access. uploads.ts
uploads Storage BEFORE registering assets, demo cover files aren't independent
asset rows, and cover_path/profile photos also live in this bucket. A policy
that merely checks assets.org_id would hide existing operational files and
would not close the current folder-wide allow rule unless it is replaced.

Recommended follow-up: retain owner CRUD, replace folder-wide label SELECT
with explicit per-object authorization (asset_org_grants or release-scoped
sharing, verified by organization + asset/path), derive cover access from its
explicitly shared parent, and require an intentional artist grant for personal
demos. Reject org attempts to change owner_id, org_id, artist_id and canonical
paths. Backfill explicit grants ONLY for established release/label workflows,
not every personal file, after a business decision; test metadata, original
objects and cover URLs together. This needs a separate migration and UI/data
flow changes. Merely adding the new private bucket doesn't fix originals.

### MEDIUM: global artist/org lookup is not many-to-many (open)

my_artist_id() and my_org_id() each select LIMIT 1 without ordering. Tasks,
messages, promo and statistics rely on these single global lookups. artists
allows multiple rows per user, so choosing a global artist is ambiguous. New
private audio bypasses this architecture using assets.owner_id. Existing
cabinet organization selection needs its own explicit-context redesign.

### HIGH: legacy org asset UPDATE is too broad (open)

assets: update own or org has no general column guard. A label can change
existing org-assigned asset fields, potentially including owner_id. New
publication fields are owner-guarded and identity changes with new dependent
records are blocked, but legacy assets without such records still need a
separate ownership/association guard. This PR does not claim to fix that model.

## Local reproducible tests

No Docker engine or native psql is installed (docker symlinks are broken).
A disposable PostgreSQL WASM instance is used instead. It runs real SQL, RLS,
roles, constraints and PL/pgSQL, with minimal Auth/Storage fixtures. It does NOT
exercise GoTrue, PostgREST, Storage HTTP, signed URLs, JWT verification, S3, or
concurrent connections. It is not a full local Supabase-stack test.

```sh
npm install --prefix /tmp/unit-private-audio-tests --no-audit --no-fund --save-exact @electric-sql/pglite@0.3.14
UNIT_PGLITE_MODULE=/tmp/unit-private-audio-tests/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/private-audio/run.mjs
```

The runner never loads .env and has no network/remote-DB connection. It replays
all 19 historical migrations plus the new one and seeds an existing demo before
the new migration. It compares its old fields byte-for-byte (JSONB), checks new
private defaults and the existing demo SELECT query shape. The access suite
runs under artist A, artist B, label A, label B, anon, authenticated, and the
restricted backend role, checks constraints, rotation, nonce replay, TTL,
cascades, and reproduces legacy original exposure. Test fixtures roll back.

For a REAL DISPOSABLE LOCAL Supabase database, apply migrations using your local
CLI, then run ONLY access.sql via psql as the migration owner. Never run
bootstrap.sql on an existing database; it is a minimal fixture, not a migration.
The test file uses fixed synthetic fixture IDs; never run it in production.

## Remaining gates / PR 2 handoff

- Read-only remote migration-history verification and deployed advisors require
  the correct active dev project. Empty inactive-project advisors are inconclusive.
- Run the SQL suite on full local Supabase and add HTTP negative tests for list,
  download, signed URL, upload, move/copy and deletion before exposing playback.
- Concurrency lock ordering uses asset then link then session where applicable;
  full multi-connection issuance/rotation races need integration testing.
- PR 2 worker may build variants, but PRIVATE SHARING MUST NOT LAUNCH while
  originals retain folder-wide label access. Fix that leak before real users
  rely on the privacy promise.
- Source fingerprint must be recomputed from source content; old variants must
  never be reused after source replacement just because asset ID is unchanged.
- Delete physical playback files BEFORE deleting their registered variant, or
  use an audited cleanup job: DB cascade deletes metadata, not S3 bytes. After
  cascade, the restricted worker no longer has path authorization for orphans.
- Future APIs must use server-side owner checks, constant-time digest comparison,
  PIN rate limiting, secure session cookies and expiry/revocation checks on each
  authorization. DB constraints do not prove a PIN was checked or audio played.
- download_enabled=false is a product switch, not DRM; playable audio can be recorded.
- No PR 2 implementation is included.

## Executed checks (2026-11-22)

- Disposable PGlite SQL replay/access suite: PASS, including existing-demo
  preservation, two-label scenario, positive restricted-worker Storage CRUD,
  client denial and append-only analytics. Bootstrap substitutes only Auth and
  Storage table contracts; this is NOT full Supabase verification.
- `npx tsc --noEmit`: PASS.
- `npm run lint`: FAIL, 36 pre-existing errors / 34 warnings, measured before
  implementation and unchanged afterward. All errors are in unchanged app or
  component TSX files (primarily react-hooks/set-state-in-effect, purity and
  static-components). No new UI or lint configuration changes were made.
- `npx eslint supabase/tests/private-audio/run.mjs`: PASS.
- `npm run build`: FAIL, Turbopack/PostCSS cannot bind its internal process
  port in this environment (Operation not permitted), including a retry with
  elevated execution permission. This is not reported as a passing check.
- `npm run build -- --webpack`: PASS (compile, TypeScript, static pages,
  optimization/traces). No bundler configuration was changed in the repo.
- Supabase Security Advisors: tool returned no notices for the inactive UNIT
  project; result inconclusive, not a pass for the deployed schema.
- No production migration, reset, data deletion, or project restoration.
