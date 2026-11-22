# PR 1.1 — Legacy Asset Access Hardening

## Phase 1: read-only audit, before implementation

Base inspected: `225fb23`, branch `feat/private-audio-db-security`. PR 1 is OPEN,
not merged; its migration matches its report (private tables, safe metadata
view, NOLOGIN worker, restrictive playback bucket denial, session invalidation).
This PR is stacked on PR 1, not main. Uncommitted next.config.ts, Dockerfile,
.dockerignore and app/api deployment files are excluded.

Read AGENTS.md, package.json, all migration history, uploads.ts, demos.ts,
client.ts, cabinet.ts, label.ts, AssetManager, DemoContext, DemoSection,
ModerationPanel, demo/edit, ReleaseUploadModal, release detail and label file
cards. Grep covered all assets, cover_path, Storage and signed-URL call sites.
No existing label UI uploads originals or modifies assets: moderation writes
releases, and reads clean assets. Thus view = metadata + readable original;
manage = title-only, limited to existing manager/project/delivery roles.
Finance, marketing and scout remain read-only even with manage.

### Actual access map and preserved permissions

| Path | Current behavior | Required preservation / new authority |
|---|---|---|
| uploads.uploadAsset → AssetManager | Storage upload first (TUS for audio), assets INSERT; cleanup if INSERT fails | Owner folder INSERT, owner metadata CRUD, private defaults |
| listAssets → ArtistFiles/AssetManager | SELECT *, signed original URL, owner deletion | Explicit owner filter added, RLS still independent defense |
| listDemos → DemoContext → DemoSection/edit | Audio without release_id, sorted; signs original and cover_path | Owner-only library listing, rename/sort, playback, covers unchanged |
| replaceDemoAudio / setDemoCover | Upload new object, update metadata pointer, remove new on error / old after success | New pointer must be an existing owned object; non-owner cannot replace; zero-row writes detected |
| createRelease / addReleaseAsset | Upload audio/cover, attach assets by ordinary UPDATE | Owner-checked RPC atomically attaches + shares to the release's explicit org |
| fetchArtistAssets → label artist detail | All artist files via broad RLS; signs supplied path | Only active explicit grants, same query/UI, no membership fallback |
| ModerationPanel | Read assets by release_id + is_clean_version, sign original | Release submission creates view grant; clean flag remains owner-controlled |
| signCover (cabinet.ts) | Sign releases.cover_path, which has no asset row | Exact release-cover registry written only by owner workflow / approved backfill |
| demos.cover_path | Photo object without separate asset row | Grant of parent asset covers current, owner-folder cover only |
| deleteRelease | Owner/label old release permissions; attempts cover removal | Label cannot delete artist Storage objects; existing release permissions unchanged |

Signed URLs are issued in uploads.ts, demos.ts (via uploads helper), cabinet.ts,
label.ts, ModerationPanel. Each uses the caller's anon-key client/session, not a
service key. New RLS gates issuance. Existing TTL is generally 3600 seconds;
previously signed URLs may work until expiration. No instant revocation claim.
Profile avatar in current UI has no additional Storage upload path in this
repository; no unregistered avatar folder is opened to label members.

Remote inventory on 2026-11-22 again reports Unit Creative as INACTIVE. It was
not restored. No remote migration/history/policy inspection is claimed. The
prior inactive-project advisors result is not a security pass. Another active
project is unrelated and was not queried.

## A. Security findings

| ID | Severity | Root cause / affected paths | Resolution | Residual risk |
|---|---|---|---|---|
| HIGH-01 | High | Membership-based assets SELECT + folder-wide artist-files SELECT / can_access_user_folder | Explicit grants; restrictive exact-object RLS; helper retired to owner-only | Old signed URLs/copies survive; full Storage HTTP suite pending |
| HIGH-02 | High | Org UPDATE could rewrite owner, path and association | Immutable id/owner/created_at/kind; owner-upload pointer validation; owner-only attach RPC; manage title-only | Trusted DB operators/service credentials remain privileged |
| MEDIUM-01 | Medium | my_artist_id/my_org_id LIMIT 1 | No such helper in new authorization; concrete grant.org_id joined against current membership | Tasks/messages/global org selector remain a separate task |
| COVER-01 | High | Mutable releases.cover_path could authorize unrelated photo | Exact owner-registered cover objects, checked against active grant + matching org/parent | A changed cover needs owner resubmission/registration; no folder exception |
| BUCKET-01 | High if present | Public artist-files bucket bypasses SELECT RLS | Migration forces artist-files public=false | Live configuration not inspectable while project inactive |

## B. Changes and implementation phases

Migration `20261122111038_asset_access_isolation.sql` is additive except for
replacing the two unsafe asset policies, the unsafe Storage SELECT policy and
old folder helper semantics. No historical SQL is edited.

1. Grants: public.asset_org_grants, active pair uniqueness, FK/provenance/history
   checks, RLS SELECT for owner/org, no browser table writes. Owner-only
   grant_asset_to_org and revoke_asset_org_grant determine grantor from auth.uid.
   Permission changes revoke old record and append a new one. Labels and artist
   B cannot share or revoke A's file. Deleting an asset/org/user cascades its
   grants; revocation itself never deletes history.
2. Asset RLS: owner OR valid explicit grant, no global artist/org lookup. Helpers
   live in non-exposed asset_access with fixed empty search_path, explicit auth
   checks and narrow EXECUTE grants. Both permissive policies and restrictive
   boundaries are installed; anonymous access is denied even if old rules drift.
3. Storage RLS: full original path, current parent cover, or exact registered
   release cover. No grant means no label original/list/sign access. Registry is
   internal and inaccessible to browser roles. Label memberships never grant
   access to the audio-playback bucket. Insert/update/move/delete destination
   remains the owner folder; restrictive policies prevent other permissive rules
   from granting write access into someone else's folder.
4. UPDATE guards: ordinary owner replacement requires already-uploaded object
   in matching owner/kind folder; cover replacement requires owned photo.
   id/owner_id/created_at/kind cannot change for clients; org_id/artist_id/
   release_id use a checked workflow instead. Non-owner manage compares the
   WHOLE JSON row except title, protecting future columns by default.
   Guard is intentionally SECURITY INVOKER: trusted owner-checked RPC/migration
   writes use postgres; direct clients run as authenticated. A custom GUC is not
   used as an escape hatch. Existing PR 1 private publication guard is retained.
5. Workflow: public.attach_asset_to_release requires caller owns asset AND
   release, checks the exact artist↔org↔user relation, association conflicts,
   original and cover paths/objects; asset attachment, view grant, cover
   registration commit together. Existing grant history is not silently deleted.
   The owner explicitly re-submitting an asset can re-issue a previously revoked
   release grant; the unattended backfill cannot.
6. Backfill: no grants are created during migration. See separate read-only
   dry-run.sql and opt-in backfill.sql in supabase/operations/asset-access.

TypeScript changes are limited to the data layer: RPC wrappers, release
submission calls replacing raw release_id UPDATE, ownership filters for artist
libraries/demo operations, and checking replacement update results. No UI or
new player functionality. No dependency changes or new secrets.

## C. Compatibility and deliberate behavior changes

SQL tests preserve existing asset rows byte-for-byte and exercise owner upload,
rename, sort, cover replacement, source replacement, deletion, grant-scoped
label reading and the exact moderation clean-version query. Full browser/E2E
compatibility is NOT claimed without a full Supabase instance.

- Upload remains Storage-first, assets INSERT second: default private and
  allowed cleanup of an unregistered owned object are preserved.
- Source/cover replacement uploads first and changes the pointer only after
  database validation. Failed updates remove the newly uploaded object.
- When attaching an upload fails, that upload remains a valid owner-private
  material; no partially issued grant or cover-registry row is committed.
  Retrying the owner attachment is safe. Release creation is still a multi-step
  process across Storage/DB; this PR does not pretend it is a distributed txn.
- Existing release files need approved backfill or explicit owner resubmission
  after cutover. No silent membership fallback. Run cutover in maintenance time.
- Personal demo-sharing UI is a separate follow-up. Owner-checked RPC and client
  wrappers exist, but this PR adds no new controls. A user with multiple labels
  can explicitly grant either/both organizations without a global artist ID.
  Existing fetchMyArtistLink().maybeSingle() still cannot pick between multiple
  label relations; the release organization chooser is a documented UI follow-up.
- Grants are per asset, independent of release lifecycle. An explicit grant
  remains until the owner revokes it; deleting/reassigning a release is not an
  implicit revocation. The release-cover registry also checks current parent,
  release and org so it cannot become an arbitrary-photo capability.
- view necessarily permits saving a copy. A granted reader can download and
  upload bytes into their OWN folder. Storage.copy to own folder has the same
  capability; copy into another user's folder is forbidden. Revocation cannot
  recall copies, recordings or previously issued signed URLs. No download right
  is invented because it would give a false separation from reading.

## D. Reproducible tests and actual results

SQL runner uses PGlite 0.3.14 installed in a temporary folder, not a dependency.
It replays all migrations, runs PR 1's original checkpoint BEFORE hardening,
seeds historical assets, applies hardening, compares all existing fields/IDs,
and executes cases A–J. Separate dry-run/backfill fixtures check only one
unambiguous release grant is issued and repeated backfill changes nothing.
Historical private, conflicting, missing-object and previously revoked records
remain unshared. The historical PR 1 runner is pinned to its own migration
checkpoint because its old finding assertions deliberately expect the old leak.

```sh
UNIT_PGLITE_MODULE=/private/tmp/unit-private-audio-tests/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/private-audio/run.mjs
UNIT_PGLITE_MODULE=/private/tmp/unit-private-audio-tests/node_modules/@electric-sql/pglite/dist/index.js node supabase/tests/asset-access/run.mjs
```

The SQL tests simulate table operations used by list/download/sign/upload/
update/move/copy/delete. This does NOT prove GoTrue/PostgREST/Storage HTTP or
JWT behavior. Native PostgreSQL concurrency is also not tested by PGlite.

`storage-http.mjs` is the separate REAL disposable-local suite: GoTrue login,
PostgREST grants and updates, Storage list/download/signed-URL fetch, TUS,
cover isolation, replacement, release clean versions, owner/granted/ungranted/
anonymous operations and playback denial. It refuses remote URLs, requires
explicit disposable-local acknowledgement and explicit test-only keys, never
loads .env, and removes only fixture IDs it created. Service key is used only
by the Node test to create/delete local fixtures, never in client code.

```sh
# Local instance must already have all migrations applied.
UNIT_DISPOSABLE_SUPABASE=yes \
UNIT_TEST_SUPABASE_URL=http://127.0.0.1:54321 \
UNIT_TEST_SUPABASE_ANON_KEY='<local anon key>' \
UNIT_TEST_SUPABASE_SERVICE_ROLE_KEY='<local service key>' \
node supabase/tests/asset-access/storage-http.mjs
```

This environment has broken Docker executable links and no full disposable
Supabase. HTTP suite was invoked and reported NOT RUN (exit 2) at its safety
gate; it is not counted as a pass. No live user objects or credentials used.

## E. Migration safety and deployment order

All original IDs, paths, cover pointers, associations and user files remain.
New grants during migration: ZERO. Bucket private flag is explicitly restored.
No S3 moves/renames/deletions. No historical migration edits.

Before production:
1. Merge/apply PR 1 first on staging; this branch depends on it.
2. Activate/access the intended DEV project only with owner approval; compare
   deployed migrations, grants, helper definitions and Storage policies to Git.
3. Run all migrations and HTTP suite on a full disposable Supabase stack. Run
   Security Advisors; resolve unexpected policies/functions instead of assuming
   migration history accurately describes live state.
4. Take/test backups; review historical release ownership and associations.
5. Stage the migration, inspect dry-run exclusions/conflicts. A valid candidate
   requires matching release owner + artist user + specific organization,
   consistent optional asset associations, existing canonical original and
   cover objects, and no duplicate original path. Historical data may itself
   be untrusted; operator review is required, not inferred consent for every file.
6. With approved candidates, run `psql -v ON_ERROR_STOP=1 -v
   apply_asset_backfill=true -f supabase/operations/asset-access/backfill.sql`
   on the intended database during controlled cutover. Never run automatically
   on startup. It retains an existing owner's grant/revocation decision.
7. Deploy the data-layer change together with the migration; old raw attachment
   UPDATE calls will be rejected. Existing label release files remain denied
   until backfill/explicit owner resubmission. New submissions share atomically.
8. Verify A/B isolation, new signed URL denial after revoke, release cover and
   clean-version moderation, then reopen normal use. Do not roll back to broad
   folder policies to restore a missing grant.

## F. Remaining risks

Old URLs/copies, offline cache, superuser/service credentials, physical orphan
cleanup and source fingerprints retain their previously documented limitations.
The source pointer can change under owner control; PR 2 must compute content
fingerprints and not reuse variants on asset-ID alone. Tasks/messages/global
artist identity remain out of scope. A local HTTP test on a full stack plus
multi-connection grant/revoke/attach race tests remain required. Trusted backfill
must run during a quiet window; lock/serialization failures must roll back and
be retried after inspection. No production privacy guarantee is made from a
WASM fixture alone.

## G. PR 2 readiness

BLOCKED for a verified PR 2 handoff: SQL owner/grant boundaries and compatibility
assertions pass, but full disposable Supabase HTTP checks, deployed-schema audit
and approved legacy backfill remain gates. This is a reviewable draft, not a
production privacy guarantee. No PR 2 implementation is part of this change.

### Executed quality comparison (2026-11-22)

| Check | Base / before | After PR 1.1 |
|---|---|---|
| PR 1 checkpoint SQL | passed in PR 1 | PASS again, pinned to original checkpoint |
| PR 1.1 SQL + backfill | not applicable | PASS, every migration replayed, A–J policy matrix |
| TypeScript | PASS from PR 1 base | PASS (`npx tsc --noEmit`, repeated after data-layer changes) |
| ESLint full project | fresh baseline: 36 errors, 34 warnings | same 36/34; exact finding comparison: 0 new |
| ESLint changed TS / test runners | no new files | PASS |
| Standard build | PR 1: internal Turbopack port forbidden | same environment failure, even elevated execution |
| Webpack build | PR 1: PASS | PASS, compile + TypeScript + static generation + traces |
| Full Supabase HTTP | unavailable | NOT RUN, exit 2 at explicit local safety gate |
| Remote policies/advisors | inactive / unverified | still INACTIVE; not restored or queried as if healthy |

No UI, dependency, production data, deployment config or historical migration
changes are included. SQL verification is a disposable WASM database, and the
builds use the existing local deployment-preparation config without including
that config in this PR.

## Subsequent native verification

The earlier NOT RUN/BLOCKED snapshot above is superseded by
[asset-access-native-verification.md](asset-access-native-verification.md).
A real disposable Supabase was started, the HTTP suite exposed an INSERT
RETURNING regression, and separate migration 20261122115339 fixed it. The
unchanged HTTP suite then passed. Native dry-run/backfill, repeat-run idempotence,
asset preservation and the 22-file migration order also passed on synthetic data.
The inactive project's real schema/data remain unverified; production cutover
still requires that audit and explicit backfill approval.
