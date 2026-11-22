# PR 1.1 — Real disposable Supabase verification (2026-11-22)

## Environment and boundaries

A fresh local Supabase was actually started, not simulated by PGlite.
Docker was absent, so a temporary Lima 2.3.0 VZ Linux VM was created with
3 CPU / 6 GiB RAM. Only the disposable project directory was mounted; no
home-directory or .env.local mount/copy. No system Docker Desktop installation.
API localhost:55421, PostgreSQL localhost:55422. Supabase CLI pinned to 2.81.3.
Only PostgreSQL, GoTrue, PostgREST, Storage and Kong were enabled.

Observed image versions: postgres 17.6.1.095, gotrue v2.187.0, postgrest v14.5,
storage-api v1.41.8, kong 2.8.1. Local anon/service keys stayed in a mode-0600
scratch file and child-process environment, never in source, .env.local or logs
shown to the user. Service credentials only seeded/deleted local test fixtures.

Unit Creative cloud project remains INACTIVE. No restoration, production SQL,
cloud migration, real user-data export or live grant backfill was performed.
The unrelated active cloud project was not inspected.

## First HTTP run: FAIL, regression discovered and fixed

The exact prepared `supabase/tests/asset-access/storage-http.mjs` initially failed
at register audio: `new row violates row-level security policy for table assets`.
Storage upload succeeded; `.insert(...).select().single()` did not.

The SELECT policies called a STABLE helper that re-queried assets by ID. In
INSERT ... RETURNING that helper's statement snapshot cannot find the new row.
The earlier SQL fixture inserted without RETURNING, so it missed this regression.

Separate corrective migration, without editing historical migrations:
`20261122115339_asset_owner_returning_access.sql` adds the direct row-owner
predicate `owner_id = auth.uid()` to BOTH permissive and restrictive asset SELECT
policies, retaining grant-based access for non-owners. No write privilege or
membership-based access was added. SQL regression now explicitly uses RETURNING.

The correction was applied only via `migration up --local` against this disposable
project. All 22 migration versions were verified in the real database history.

## Second HTTP run: PASS

The same prepared test ran to exit code 0 after the correction. Actual network
requests exercised:

- Real GoTrue password login for four synthetic users (two artists, two labels).
- Owner Storage upload and PostgREST asset registration/returning.
- Independent artist isolation and the same artist linked to two organizations.
- Owner-only grant issuance/revocation; label self-grant and artist B denied.
- Granted metadata, download, list, cover and signed URL creation + HTTP fetch.
- No cross-label inheritance and no neighboring-photo access.
- No label upload/overwrite/move/delete into the artist's folder; original survives.
- Explicitly readable content can be copied into the recipient's own folder;
  ungranted copies fail. Reading cannot be treated as copy protection.
- Grant revocation blocks new original/cover reads and new signed URLs.
- Old signed URL was observed returning HTTP 200 after revocation, as expected
  before its expiry; no instantaneous URL-revocation claim.
- Manage title changes work; owner/path/org/artist modifications fail.
- TUS upload with progress, owner audio replacement, old path stops being shared.
- Cover replacement, owner release attachment, clean-version moderation query,
  registered release cover and other-label denial.
- Actual existing playback object denied to artist, both labels and anon for
  download and signed URL creation.
- Owner Storage update/move/copy/delete and final asset deletion.

The test's finally block removed its generated users, organizations and files.
A subsequent actual dry-run returned zero assets/candidates/exclusions.

## Native dry-run/backfill rehearsal: PASS, synthetic legacy records only

To make the dry-run meaningful, five synthetic historical asset records and six
REAL Storage objects were created in the disposable instance. The existing
legacy-fixtures SQL was reused for metadata, excluding its simulated
storage.objects INSERTs. Actual file objects were uploaded through Storage HTTP.
One previously revoked grant was seeded to test history preservation.

Executed the repository's exact `supabase/operations/asset-access/dry-run.sql`:

| Result | Count |
|---|---:|
| Existing synthetic assets | 5 |
| Personal/unattached | 1 |
| Unambiguous release candidates | 2 |
| Candidates with no grant history | 1 |
| Attached records excluded (conflict / missing object) | 2 |
| Duplicate-original groups | 0 |

Then executed the exact backfill.sql with explicit opt-in ONLY on these fixtures:
first run inserted one cover-registry record and one backfill grant; second run
inserted zero. Grant state: one active backfill/view and one still-revoked
owner/view. No private-demo grant, no conflict grant, no missing-file grant,
no resurrection of revoked access. Hash snapshots of ALL five assets before and
after both runs match exactly, including IDs, paths, associations and covers.

Native PostgreSQL RLS under the fixture label's authenticated UID sees exactly
one asset and three authorized objects: original, current demo cover and exact
registered release cover. The backend role is NOLOGIN/NOBYPASSRLS; authenticated
has neither private_audio schema usage nor secret-table SELECT.

This is verification of the dry-run and backfill algorithms on representative
historical fixtures, NOT a report of the inactive cloud project's user data.
A real-data dry-run still requires approved access to that project or its backup.

## Verified migration application order

Fresh native database successfully applied all 21 initial files in timestamp
order, then the corrective 22nd file via the local migration command:

1. Existing 19 migrations: 20260725083607 through 20260916180000.
2. PR 1: `20261122101423_private_audio_db_security.sql`.
3. PR 1.1: `20261122111038_asset_access_isolation.sql`.
4. HTTP regression fix: `20261122115339_asset_owner_returning_access.sql`.

Before an existing deployment, compare its actual schema_migrations with Git;
do not replay all history blindly. Production sequence remains: backup/quiet
window, apply ONLY missing migrations in order (including the RETURNING fix),
read-only dry-run, explicit review of conflicts and candidate provenance,
approved manual backfill, deploy the matching owner-attachment data layer and
verify with real owner/label accounts before reopening normal use. Never restore
folder-wide access as a compatibility workaround. Existing release material
remains denied until explicit owner submission or approved backfill.

## Remaining limits / readiness

The real HTTP blocker is resolved and native local testing passes. PR 2 worker
development is READY WITH LIMITATIONS; production cutover remains gated on the
inactive project's actual schema/history audit and real-data dry-run approval.
Old URLs/copies and trusted service/superuser access retain documented limits.
Multi-connection race/stress testing and global artist/org selection remain
separate tasks. No media worker or player UI was implemented.

The disposable VM and its containers are stopped/removed after evidence capture;
only non-secret test reports and source changes are retained. Cloud services
and the existing application environment are unchanged.
