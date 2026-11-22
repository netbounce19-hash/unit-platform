# Completed live cutover — Unit Creative, 2026-11-22

## Observed live state

Project nxdbpaayojzesezhcskb is ACTIVE_HEALTHY; Auth health returns HTTP 200.
Read-only preflight after restoration observed:
9 assets / 13 Storage metadata objects; 6 unattached assets, 3 release assets.
Conservative candidates: 2. The excluded release asset belongs to a release
without an organization/artist association, so it must remain owner-private.
No duplicate-original groups and no multi-org artist accounts were found.

Before-state snapshots of asset/object hashes, Storage/asset policies, permission
helpers, buckets and the original migration ledger are saved privately under
/private/tmp/unit-live-cutover-20261122 (mode-0700 directory, mode-0600 snapshots).
No audio, document, email, user password, or production service-key dump was made.
The public site embeds the expected nxdbpaayojzesezhcskb Supabase endpoint.

## Ledger agreement

Cloud has 21 historical rows; repository originally had 19 baseline migrations
plus 3 new security migrations. Sixteen baseline SQL bodies are token-equivalent
(disregarding comments/spacing/dollar-quote tags); three differences were audited:

- messages: attachment + CHECK already exist in live schema, but body lacks the
  repository's empty-string default. The new reconciliation migration sets it.
- moderation_and_royalties: the separate cloud royalty_paid_not_to_draft patch
  makes the final guard equivalent to the repository baseline.
- stream_periods: only idempotent creation/drop wrappers differ.

Two cloud-only histories are now imported under their original timestamps:
20260827094014_guard_task_fields and 20260915144716_royalty_paid_not_to_draft.
No existing historical file was rewritten. A fresh replay imports those histories;
the new reconciliation migration removes the obsolete duplicate task guard
trigger/function so fresh and existing final behavior agree.

Map: supabase/operations/asset-access/cloud-history-map.json. Keep the two
cloud-only rows. Rename the 19 verified baseline ledger versions to canonical
repository versions only AFTER successful cutover, retaining original statement
arrays and the private before-ledger snapshot. Register the three security files
and reconciliation file with their canonical versions after their exact SQL has
actually run; never mark unapplied schema as applied. No blind db push or replay
of old migrations. Expected final source/ledger count: 25.

## Prepared atomic SQL

/private/tmp/unit-live-cutover-20261122/cutover.sql contains:
1. PR 1 private audio foundation (20261122101423).
2. PR 1.1 explicit asset grants (20261122111038).
3. Owner INSERT RETURNING correction (20261122115339).
4. Legacy reconciliation (20261122124948).
5. Locked count guards (9 existing assets, 2 reviewed candidates), then the
   conservative backfill. Expected 2 view grants; all other assets unshared.

All source files replayed successfully in disposable PostgreSQL WASM, including
the imported cloud histories, SQL isolation suite and backfill regression. The
previous real Supabase HTTP run passed with the security files; matching
frontend commit f1a1c2b has a READY Vercel preview.

Production currently serves f997ee7, whose release attachment uses raw UPDATE.
It is incompatible with the new guard. A complete approved cutover therefore
includes a production build/deployment of tested f1a1c2b from the existing Git
connection, with the current production environment, and production alias/health
verification. Do not merge drafts or change main implicitly. During the build,
release submissions on the old frontend may temporarily fail; users may need
to refresh after release. No membership fallback or relaxed RLS is acceptable.

## Approval block

The first atomic apply_migration request was rejected by automatic approval
review BEFORE execution: production RLS/backfill would change while the old
incompatible Vercel code was still live, and this risky ordering lacked explicit
approval. No migration, grant/backfill, ledger rewrite or production deployment
was executed. Do not bypass this through individual SQL calls.

An explicit approval question describes the complete ordering and temporary
release-upload risk. Until approved, keep this as a reviewable prepared change.
After approval: atomic schema/backfill → immediate matching production deployment
→ ledger alignment with original-source guards → preservation/RLS/health checks.
If any precondition changes, stop and re-audit; never force old history through.

## Completed after explicit approval

The user explicitly approved the migration → immediate production deployment →
history alignment sequence and temporary release-upload interruption on
2026-11-22. The previously rejected operation was retried only after approval.

- Atomic migration/backfill succeeded; exactly two grants were created.
- Existing 9 asset rows (all original columns) and 13 Storage metadata objects
  retain identical before/after hashes. No object contents were modified.
- History now matches all 25 repository migration versions and names. Historical
  statement arrays were retained for renamed baseline entries; exact executed
  source SQL was recorded for the four new migration entries. The metadata
  transaction checked all 22 pre-repair row names and statement hashes.
- Vercel production deployment dpl_5Mq18KqfVJa4joYcEboZnpo2weiD is READY at
  https://unit-platform.vercel.app, commit f1a1c2b4ff7ef5fea005ec75d411e0ab3f4510ce.
  Public HTTP check returned 200. No error/fatal runtime logs were found for this
  deployment in the checked window; that is not a full production user-flow test.
- Current security catalog shows explicit restrictive asset/Storage boundaries,
  private playback bucket, and no browser SELECT privilege on the private cover
  registry. No conservative backfill candidates remain without grant history.
- Advisors still flag legacy function/search-path/password settings. The new
  definer metadata view is intentional: explicit auth.uid owner filtering and
  safe projected columns hide secret tables. The no-policy private cover table
  is intentionally inaccessible to browser roles. No unrelated security setting
  was changed. Native full HTTP tests were run on disposable Supabase before
  production, not against real users during this cutover.

Earlier preparation/approval sections above are retained as the audit trail.
