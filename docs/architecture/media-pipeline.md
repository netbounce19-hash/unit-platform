# PR 2/6 — bounded, demand-driven audio pipeline

## Scope and rollout gate

Base: PR #3 `702ccbc`, stacked on open Draft PR #2 `f1a1c2b` and PR #1
`225fb23`; none was assumed merged. PR 1.2 still lacks the expanded native
Supabase sign-off. **Synthetic/disposable development only. No production
migration, worker, scheduler or deployment has been enabled.**

`localCredentials()` hard-rejects hosted endpoints, non-loopback origins,
hosted JWT refs, non-demo issuers and missing explicit disposable acknowledgement.
No production override exists. The executable entry also requires actual Linux
cgroup-v2 CPU/RAM/PID limits and a size-limited tmpfs. Short synthetic processor
tests run independently on macOS; that is not a deployed worker.

## Technical decision

1. Reuse `artist-files`, `audio-playback`, asset ownership/RLS, and existing
   `audio_playback_variants`. No UI/upload hook: private demo upload costs no
   transcoding. No share-link code or playback endpoint is added.
2. Add `media_jobs`: variants alone lack source snapshots, scheduling, attempts,
   lease/fencing and operational metrics. Add `media_cleanup` tombstones so
   cascaded metadata deletion cannot lose the exact physical-object cleanup plan.
   All new tables are private/RLS, with no browser or broad backend-role grants.
3. Internal `lib/audio/queue.ts` accepts a user-scoped Supabase server client,
   authenticates and calls the owner-checked `request_playback_variant` RPC.
   Request/status is a single idempotent operation returning only job/variant IDs,
   status and a stable error code. No public HTTP route was needed.
4. Separate Node worker executes system FFmpeg/FFprobe via spawn argument arrays,
   with no shell or decoder-network protocols. Bytes travel Storage → worker →
   Storage, never through a Vercel function or browser.
5. Atomically claim via `FOR UPDATE SKIP LOCKED`. A random fencing token changes
   on every lease; 90-second leases heartbeat every 20 seconds. Completion checks
   token, expiry, source snapshot and physical Storage metadata before ready.
6. Default concurrency one, FFmpeg thread one, capped attempts three, transient
   failures only, 30/60-second exponential delays plus 0–10 seconds jitter.
   A lower attempt cap is persisted on the job at claim, including crash recovery
   by a different worker; a higher worker setting cannot raise it afterward.
   Polling backs off from 2 to 30 seconds with jitter. A single process supports
   batch (default, idle exit) and `--continuous`; no Redis/queue service/ORM.
7. No new npm dependencies. Built-in crypto/streams/fs/spawn/fetch suffice.
   FFmpeg is a separately provisioned system runtime, never bundled in Next.

## Schema and state machine

New migration: `20261122175310_optimized_audio_media_pipeline.sql`, generated with
CLI migration new; older migrations untouched. This migration is **not applied**
to hosted UNIT. It follows all 25 baseline/security/reconciliation files.

Variants retain `pending/processing/ready/failed` and existing canonical paths
`{owner}/{asset}/{variant}.mp3`. Add profile version, output SHA256 and retirement
time; unique key becomes `(asset_id,source_fingerprint,output_profile_version)`.
No deduplication across assets or owners. Pre-existing variants are tagged legacy-pr1, so unqualified old outputs are not silently treated as verified v1; new pipeline outputs use mp3-192-v1.

Jobs use `pending/processing/completed/failed/cancelled`, one row per
asset/Storage revision/profile. Source path/revision are immutable snapshots
chosen by SQL, never supplied by the frontend. Revision uses Storage object ID,
version, updated_at and metadata, deliberately not read-access timestamps.
It is **not** a content fingerprint. Every first processing attempt streams and
hashes actual source bytes using SHA256. A completed unchanged Storage revision
can then answer requests without downloading or running FFmpeg again.
A new Storage revision with identical bytes must be downloaded once to establish
identity, then reuses the existing ready variant. Native Storage version-change
semantics still need the integration gate; the small SQL bootstrap cannot prove it.

RPCs: owner-only `request_playback_variant`; service-role-only `media_claim`,
`media_heartbeat`, `media_resolve`, `media_complete`, `media_fail`,
`media_cleanup_claim`, `media_cleanup_done`. Private helper EXECUTE is revoked.
Only an owner may enqueue, even if a label has a manage grant. Server-side queue
limits are four outstanding jobs per owner and 1000 globally; duplicate requests
reuse the existing job and increment request_count. A short admission advisory lock makes per-owner/global backpressure atomic across different assets. No automatic retry of a
terminal bad file on every owner request. A changed source gets its own job.

Claim/heartbeat/publication recheck source revision. Final checks hold asset and
Storage metadata row locks, so a normal replacement cannot race the ready write.
Deletion cascades jobs/variants; late workers lose their publication authority.
An expired third claim becomes terminal. Deadlocks/serialization/lock errors are
classified as transient rather than blindly retried immediately.

### Fencing beyond SQL

A DB fence cannot retract an HTTP Storage request already in flight. Therefore
uploads are immutable (`x-upsert:false`), never overwrite the shared canonical
path, and no stale worker directly deletes its output. An existing-path conflict
requires streaming SHA256 + size equality with the validated local result before
publication. Mismatched bytes are `OUTPUT_COLLISION`, not silently trusted.
Successful new uploads avoid a redundant GET; a fenced SQL transaction checks
the object metadata before ready. New attempts use the same variant while its
source/profile match; terminal/deleted variants get a fresh UUID/path.

If a complete response is lost after commit, `media_fail` cannot demote the
completed job or delete a ready copy. Unknown/failed uploads leave private bytes
for the durable cleanup workflow. A stopped/paused old worker might upload late;
tombstones are retained and swept again after 24 hours, not discarded on the
first delete. This is eventual orphan cleanup, not an atomic Storage/DB commit.
Native multi-process lease/upload/cleanup races remain an explicit release gate.

## Processing and quality

Accepted containers are exactly WAV/FLAC/AIFF/MP3, inspected by FFprobe from local
bytes. Require one audio stream, PCM/FLAC/MP3 codec and finite positive duration.
Reject invalid/empty/oversized/overlong inputs before unbounded work. Output:
MP3 nominal 192 kbps, 44.1 kHz stereo; no loudness, EQ, limiting, compression,
stereo widening, tempo or pitch filters. Originals are never rewritten.

Eligible MP3 with reported 192000 bit/s, 44100 Hz and two channels is remuxed
without re-encoding; tags, chapters, artwork and other streams are stripped.
Higher-bitrate MP3 is transcoded in v1 to cap storage/egress at 192k; that is a
deliberate cost/quality tradeoff, not an assumption that every MP3 needs encoding.
Nominal bitrate is not a claim of packet-by-packet CBR verification. Changing
encoding settings or the qualified encoder build requires a new profile version.

Each result must be nonempty, under the size cap, probe as MP3 stereo/44100,
match source duration within 150 ms and fully decode with FFmpeg `-xerror`.
Output metadata hashes actual output bytes. FFmpeg gets only file/pipe protocols,
safe fixed scratch names, bounded stdout, drained/sanitized stderr and timeout.
Large originals use streaming download/hash/file upload, never a whole WAV Buffer.
Private temp directories and files are removed in finally; no binary fixtures in Git.

## Limits and runtime

| Config | Default | Hard ceiling in this MVP |
|---|---:|---:|
| MAX_SOURCE_SIZE_MB (decimal MB) | 250 | 250 |
| MAX_AUDIO_DURATION_MIN | 30 | 30 |
| MAX_CONCURRENT_JOBS | 1 | 2; benchmark before using 2 |
| MAX_JOB_ATTEMPTS | 3 | 3 |
| MAX_JOB_SECONDS | 300 | 600 |
| MAX_OUTPUT_SIZE_MB | 45 | 50 |
| MAX_TEMP_SIZE_MB per active job | 310 | 400 |
| WORKER_IDLE_TIMEOUT seconds | 60 | 3600 |
| WORKER_MAX_RUNTIME seconds | 600 | 3600 |
| FFMPEG_THREADS | 1 | 2 |

Config may lower safety limits; increasing hard ceilings requires reviewing SQL,
resource budgets and benchmarks together. `-fs` bounds output; size/duration
verification prevents publishing truncated results. `-max_alloc` limits decoder
allocations but is not a total memory limit. Actual entry-point requirements:
cgroup v2 memory ≤768 MiB, CPU ≤2 cores, PIDs ≤64, bounded tmpfs consistent with
the configured temp budget. Source+output must fit that budget; statfs checks
headroom. OOM/SIGKILL recovery uses lease expiry; a process cannot reliably log
its own death. The example service applies cgroup/group-kill limits but is not
installed here. Linux service startup/resource enforcement has NOT RUN.

`unit-audio.service.example` demonstrates a **local disposable** batch process,
not production credentials/deployment. A manually scheduled batch on existing
compute avoids paying for an idle dedicated VM. Persistent mode reduces cold
starts but reserves compute; consider it only when queue volume warrants it.
Both run the identical processing code. No timer/cron/orchestrator is enabled. Cleanup also receives a turn every minute under sustained job load, not only after the queue becomes empty. Provision qualified FFmpeg/FFprobe 9.1 explicitly; the entry checks both versions and libmp3lame before claiming any job.

### Credentials

The existing NOLOGIN `unit_audio_backend` is not usable Storage credentials and
is never minted as a browser JWT. This development implementation uses the
explicitly permitted privileged key ONLY in a disposable-local worker/fixture
process. Its scope is inherently broad: do not call it least privilege. Logs
contain stable codes and job IDs/metrics, not keys, original paths or decoder text.
No new NEXT_PUBLIC variables, .env files or key values are committed.

Before real deployment, design and validate a narrow server credential/broker:
worker receives only the claimed job's short-lived read/upload capabilities;
queue transitions use dedicated restricted server authorization. Original bytes
still go directly to/from Storage. This is not implemented or substituted with
an authenticated user's membership in unit_audio_backend. Hosted worker startup
is intentionally impossible in this PR until that and PR 1.2 gates are resolved.

## Cleanup and dependencies

Variant DELETE records a durable exact-path tombstone BEFORE cascade removes
metadata. Source replacement does not delete older ready bytes. Only successful
publication retires previous ready variants. Cleanup waits 15 minutes, refuses
active leases, preserves the current ready variant and conservatively pins old
copies while ANY active share link/session for that asset exists. The existing
session schema does not reference variants, so conservative retention costs more
than exact per-variant pinning; future gateway work must resolve that explicitly.

Cleanup removes retired metadata before issuing a physical-delete capability,
then deletes exactly one audio-playback object. Tombstones survive the process
and are rescheduled, including after successful deletion, to catch late uploads.
No wide prefix, no source deletion, no SQL storage.objects DELETE used as a
substitute for the actual Storage API. Failed DB finalization is swept only when
no valid processing lease/current-ready/dependency makes deletion unsafe.

## Metrics and measured benchmark

Each attempt logs result, attempt, input/output bytes, duration, wall/CPU time,
reuse, strategy and processing/compression ratios. Jobs accumulate known
download/upload and CPU/wall metrics across recorded attempts. In-flight partial
network transfers or an abruptly killed process can be undercounted; billing
reconciliation requires provider usage, not an assertion these counters are exact.
Completed unchanged requests count via cache_hit_count without new jobs or FFmpeg; request_count also includes pending-status polls. Operator aggregate queries are in supabase/operations/media-pipeline/metrics.sql.
CPU is FFmpeg encode + validation-decode user/system time; Node/probe overhead is not included. No separate paid observability service.

Actual synthetic pink-noise fixture: 180 s, stereo, source PCM 24-bit/48 kHz,
Node 22.11.0, macOS x86_64, one job/thread. FFmpeg/FFprobe 9.1-tessus binaries
downloaded to private scratch from the macOS provider linked by ffmpeg.org.
Their hashes are in `media-pipeline-benchmark.json`. Not production image
qualification, not signed supply-chain verification, and not a concurrency-2 test.

| Input | Input bytes | Output bytes | Wall s | CPU s (encode + decode) | processing_ratio | compression_ratio |
|---|---:|---:|---:|---:|---:|---:|
| WAV | 51,840,102 | 4,321,488 | 6.855 | 7.306 | 0.0381 | 0.0834 |
| FLAC | 20,349,514 | 4,321,488 | 6.003 | 6.518 | 0.0334 | 0.2124 |
| MP3 remux | 4,321,533 | 4,321,488 | 0.378 | 0.505 | 0.0021 | 1.0000 |

Lifecycle experiment with real FFmpeg/local files but **mocked queue/Storage**:
first processing 6.456 s; same bytes/new revision hash reuse 0.260 s without
FFmpeg; injected upload failure 6.226 s; recovery attempt 6.255 s. Excludes real
network, claim latency and backoff. These are measured local samples, not SLA.
A 50-call unchanged-ready SQL/WASM microbenchmark averaged about 2.3 ms/request in this run, without HTTP or native Storage; it is not production latency. WAV/FLAC compression is content dependent; pink noise is not a catalog forecast.
MP3 192k storage is approximately 24,000 bytes × duration seconds plus headers.

### Cost model, no invented provider prices

Let N be uploads/month, p the fraction explicitly requested for playback, U the
unique asset/content/profile jobs after reuse, a the average attempts per job,
t measured processing seconds/attempt, d transfer seconds, B batch startup+idle
seconds, I/O average source/output GB, R retained obsolete copies, P monthly plays.

`compute = (U*a*(t+d)+B) / 3600 * provider_hour_price`

`extra_storage = (U*O + R) * provider_GB_month_price`

`transfer = download_GB*source_egress_price + upload_GB*upload_price + P*O*playback_egress_price`

Add request/DB charges and existing original storage separately. U≤N*p only
without source/profile changes; multiple source versions may make U larger.
No playback request/egress is implemented here. Storage/browser cache behavior
belongs to future gateway work, not these processing benchmarks.

Illustration only: p=1, one new 180-second WAV per upload, one attempt, no retained
old variants, one month retention, no network/cold-start/idle billing included:

| Uploads/month | Worker processing h | Original download GB | Extra playback GB |
|---|---:|---:|---:|
| 100 | 0.190 | 5.184 | 0.432 |
| 1,000 | 1.904 | 51.840 | 4.321 |
| 10,000 | 19.042 | 518.401 | 43.215 |

Multiply by actual contracted provider prices; do not infer a ruble/month price.
Only explicitly prepared tracks cost processing. Batch nearby Storage to reduce
latency/egress, and account for conservatively pinned obsolete versions.

## Reproduce and quality gates

```sh
# System FFmpeg/FFprobe required. PGlite remains an external test-only install.
UNIT_PGLITE_MODULE=/path/to/pglite/dist/index.js node --test tests/audio/*.test.mjs
node tests/audio/benchmark.mjs
UNIT_PGLITE_MODULE=/path/to/pglite/dist/index.js node supabase/tests/asset-access/run.mjs
# Optional full native stack, once Docker exists (never hosted):
UNIT_AUDIO_PIPELINE_TEST=yes node supabase/tests/asset-access/disposable-local.mjs
```

FFMPEG_PATH/FFPROBE_PATH optionally select provisioned absolute binaries. The
native runner requires CLI 2.81.3 (UNIT_SUPABASE_CLI can select its binary). Native
runner passes its fresh local test keys in memory and tears down its unique
stack. HTTP test creates synthetic users/audio only and verifies all four input
formats, actual Storage writes, original preservation, owner-only enqueue and
browser playback denial. **Prepared, NOT RUN: no Docker Engine in this session.**

Actual checks: audio/storage/SQL unit suite passed (16 tests), native HTTP test
explicitly skipped (1). All 26 migration files replayed in PGlite; existing
asset/isolation/backfill regressions passed. No PGlite result is called native
Supabase. Quality gates: TypeScript PASS; targeted ESLint PASS; full lint retains the baseline 36 errors / 34 warnings; Webpack build PASS. Default Turbopack build remains BLOCKED by the internal PostCSS process/port-bind EPERM. Builds used a separate tracked-source copy, excluding pre-existing Docker/API/config changes. No unrelated lint or Next configuration changes.

Remaining release gates: PR 1.2 full native security checks; native pipeline
Storage/version/collision behavior; real multi-connection queue and cleanup races;
Linux bounded-runtime startup/OOM/crash tests; encoder image/signature qualification;
least-privilege hosted credentials and operational monitoring; concurrency-2
measurements before increasing default one. Neither this migration nor the worker
has touched hosted user files. PR 3 may be designed against the interfaces, but
real Access Gateway/Link+PIN/streaming rollout remains **BLOCKED** on those gates.

Sources: [FFmpeg](https://ffmpeg.org/ffmpeg.html),
[FFprobe](https://ffmpeg.org/ffprobe.html),
[official binary-provider links](https://ffmpeg.org/download.html),
[Supabase uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads),
[Vercel function limits](https://vercel.com/docs/functions/limitations).
Next.js server-only boundary was checked against the installed Next 16.3.5 docs.
