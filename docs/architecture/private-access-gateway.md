# Private audio access gateway — roadmap PR 3/6

## Scope and dependency audit

2026-11-22. Stacked on `feat/optimized-audio-media-pipeline`, commit `a19f2503ff1c5f05384928e0a9555f355c79ba7a`, migration `20261122175310_optimized_audio_media_pipeline.sql`. At audit, GitHub PRs #1 (database), #2 (legacy hardening), #3 (validation), #4 (media pipeline) were open Drafts, not merged into main. GitHub numbers are not roadmap stage numbers. Prior native Storage/worker qualification remains incomplete.

This change adds migration `20261122184634_private_audio_access_gateway.sql`; historical migrations are unchanged. No production migration, deployment, credentials provisioning, real-user processing or public feature activation is authorized by this implementation. The runtime refuses Vercel entirely and requires explicit disposable flags, loopback Supabase and origin, and a local demo service JWT. A production adapter is deliberately absent. Native HTTP test credentials are ephemeral and never returned to browsers.

## Delivery decision

Controlled Gateway is the only implemented delivery strategy. `controlledDelivery(...).respond(request, context)` is the delivery boundary; access authorization and sessions do not depend on direct signed URLs. A future broker must preserve the Access API and explicitly renegotiate revocation guarantees.

| Criterion | Controlled Gateway (implemented) | Short-lived signed playback (future) |
|---|---|---|
| Cost | Storage egress plus proxy transfer/compute | Direct Storage transfer, less compute |
| Revocation | Fresh DB decision for every new GET/HEAD | Previously issued URL valid until TTL |
| Throughput | Bounded streaming/backpressure, additional hop | Storage/CDN handles bytes directly |
| Vercel | Streamed-body exception; function duration still bounded | Short authorization functions |
| Storage | Authenticated private object GET; verify 206 upstream | Signed private playback URL; TTL semantics |
| Safari | Same-origin cookies and standard byte ranges; NOT browser-qualified | URL expiry, redirects, CORS and retries need browser qualification |
| HTTP count | Each stream request adds one internal Storage GET; HEAD none | Broker plus direct object request |
| Range | Strict single-range relay, reject unexpected upstream 200 | Depends directly on Storage/CDN support |
| Link forwarding | Share can be forwarded; no Storage URL exposed | Extracted signed URL reusable until expiry |
| Operations | No new queue/CDN/service; function cost monitoring needed | TTL/cache/revocation complexity |

No Download is a product restriction, not DRM. Recipients can record or save delivered audio. Already delivered bytes and already authorized in-flight responses cannot be recalled. A request authorized after revoke commits is denied; a response authorized before that transaction can finish. No positive authorization cache.

## API contract

All endpoints are Node.js dynamic Route Handlers. Management requires server-verified Supabase bearer authentication; client-supplied owner/path is rejected. All POST/PATCH requests require matching Origin and JSON, and cross-site Fetch Metadata is rejected. Responses deny caching and indexing and use no-referrer/nosniff.

- POST `/api/artist/audio/[assetId]/shares`: `{accessMode:"link"|"pin", pin?:"6–8 digits", label?, expiresAt?:ISO|null}`. Own unlisted audio only, downloads disabled, current ready mp3-192-v1 required. Returns safe fields and URL once; AUDIO_NOT_READY never invokes FFmpeg.
- GET same path: `{shares,nextCursor}`. At most 100 rows, descending `(created_at,id)`; send nextCursor in `X-Audio-Cursor` header. Query strings are rejected. Returned fields: id, assetId, label, accessMode, createdAt, expiresAt, revokedAt. No analytics added.
- PATCH `/api/artist/audio/shares/[shareId]`: whitelisted settings, PIN/mode/expiry changes invalidate prior sessions. Revoked links cannot be revived.
- POST `.../[shareId]/rotate`: atomic digest replacement and session invalidation; new URL once.
- POST `.../[shareId]/revoke`: idempotent timestamp/history, independently invalidates only that link; never deletes originals or variants.
- POST `/api/audio/access`: `{token,pin?}`. Success `{authorized,sessionId,expiresIn,streamPath,metadata}`; secret only in cookie. No metadata before authorization. Public denial is 404 ACCESS_DENIED; 429 with Retry-After for bounded overload.
- GET/HEAD `/api/audio/stream/[sessionId]`: session-specific cookie, fresh authorization, playback object only.
- GET `/u`: technical 204, no UI. One-time URL is **`<configured-origin>/u#t=<token>`**, deliberately a fragment rather than path/query. Fragments never enter HTTP access logs. PR5 must consume/clear it in browser memory and POST the token; there is no player screen in this PR. No sitemap/OG/third-party tracking added.

Tokens and session secrets use 32 CSPRNG bytes/base64url; DB stores SHA-256 digests only. SQL digest lookup is indexed; no raw-secret comparison in application. URLs cannot be recovered: use rotation. PIN uses pinned `@node-rs/argon2@2.2.2`, Argon2id m=65536 KiB,t=3,p=1, unique 16-byte salt. SHA-256 alone is inappropriate for low-entropy PINs. This is the only new production dependency; Node crypto supplies all other cryptography. Existing dependencies were not broadly updated.

Session TTL is at most 30 minutes and bounded by link expiry. HttpOnly Secure SameSite=Lax cookies are scoped to `/api/audio/stream/<sessionId>` with separate names per session, so independent tracks/tabs coexist. The anonymous rate cookie at `/api` is not an authorization credential. Native browser Secure-cookie behavior needs HTTPS qualification; Node test cookie jars do not establish that guarantee.

## SQL, isolation and state

New private rate/crypto tables have RLS and no browser grants. New public wrapper RPCs grant EXECUTE only to service_role and inert `unit_audio_gateway` NOLOGIN role. Private helpers and existing session/link storage remain inaccessible to browser roles. The role is a design boundary, not a provisioned hosted credential. Current local runtime uses broad service authority ONLY inside disposable tests; production must provision a narrow DB/Storage identity and trust adapter before removing the guard.

Owner management never derives rights from label membership. Share/session writes and variant selection are server-side. Share limits: 100 active links/owner, 20/asset, expiry at most 365 days. List history is paginated, not silently deleted. Crypto checks follow ownership/readiness preflight. Revocation/rotation/settings updates use existing invalidation triggers plus authorization_epoch fencing. Session binding to variant/source revision is immutable. A PIN checked against an old epoch cannot issue a session after settings change.

`current_playback` requires current asset source revision, completed media job, mp3-192-v1 ready variant, output/source hashes, 192 kbps audio/mpeg, and object existence. Metadata size is bounded to 50 MB. Replacement suspends playback until a newly completed current variant; even after preparation the old session remains invalid. Asset deletion cascades authorization; existing exact-path media_cleanup tombstones handle physical objects. No FFmpeg, original-file download, per-link conversion or duplicate playback copy is introduced.

## Shared abuse control

Postgres atomic counters with TTL are shared across runtime instances; no local Map limiter. Global initial budgets: 1000/minute and 100000/day; IP access/manage 120/minute, stream 300/minute; token/client access 30/minute and stream 120/minute; session issuance 10/minute/share/client. PIN failures are 5/15 minutes for both token/IP and token/client (success resets). A global five-attempt link lockout is deliberately avoided. Two distributed crypto leases plus an additional local cap bound Argon2 memory. Lease expiry is 60 seconds and daily crypto budget 10000; no-slot admission refunds PIN reservations. Cleanup removes bounded expired counter rows; expired keys do not retain raw IP.

Untrusted X-Forwarded-For is never accepted. Local ingress verifies `x-unit-client-ip`, millisecond timestamp and HMAC of IP/method/path using a separate proxy secret. HTTP fixture strips spoofed headers and signs the actual socket IP. Rate identities are daily HMAC pseudonyms with a distinct secret. A trusted production proxy/Vercel adapter and edge protections remain a release gate. Changing day/keys can reset quotas; these are abuse budgets, not billing ledgers.

Nonexistent, wrong-PIN and revoked paths use the same-cost dummy verification and uniform errors, then a 200ms minimum failure floor plus cryptographic 0–20ms jitter. Limits run first. Seven local samples/category overlap (raw values in benchmark artifact); this is not proof of constant-time behavior under cold starts, contention or production hardware.

## HTTP correctness and resource bounds

One compact `audio_gateway_stream` RPC per GET/HEAD, not per byte chunk; it includes rate admission and current link/session/revision validation. GET adds one private Storage request; HEAD adds zero. Link Only access normally uses two RPCs; PIN adds crypto lease release. Auth management also calls Auth.getUser and admission/owner operations. A SQL function can execute several SQL statements internally; "one RPC" does not mean one internal statement.

GET supports complete 200 and single closed/open/suffix 206 ranges. Unsatisfiable, malformed and multipart requests return 416 with `Content-Range: bytes */size` without fetching Storage. HEAD ignores Range, returns full metadata and no body per GET-only range semantics. Long ranges are bounded by qualified object maximum; no arbitrary segmentation, HLS or tiny-range amplification protocol. A 1KiB range requests exactly 1KiB from upstream. Upstream wrong 200 for a requested range, mismatched range/length/type/encoding, timeout or redirect fails closed. Never manufacture Content-Range for a full-file upstream response.

ReadableStream forwards bounded chunks with backpressure, highWaterMark=0, byte-count checks, abort propagation and reader cancellation. No arrayBuffer/full-file Node Buffer in production. Upstream timeout is 240 seconds and route maxDuration 300; slow full downloads can require resumption, and a 30-minute track is not a promise of a 30-minute function. Interrupted responses are not transparently retried from the beginning. Logs contain only technical status/count/latency/bytes, no IP, token, PIN, IDs, storage paths or bearer. bytes_served measures enqueued application bytes, not TCP acknowledgments or provider-billed transfer.

## Synthetic performance evidence

Actual loopback HTTP, real generated MP3, macOS x86_64 Node22.11, SQL-WASM and fake Auth. Whole-process RSS includes DB and both HTTP fixture servers; fast bulk readers are not realtime listeners. No production load. Upstream bytes equal served bytes for full requests; each small-range probe reads exactly 1024 bytes. Canonical measured sizes: 3min 4321488 bytes, 10min 14401409 bytes, 30min 43201722 bytes.

| Minutes | Concurrent clients | Auth mean ms | TTFB mean ms | Total mean ms | RSS delta MiB |
|---|---|---|---|---|---|
| 3 | 1 | 17.00 | 12.05 | 61.69 | 15.84 |
| 3 | 10 | 9.39 | 72.60 | 382.27 | 36.20 |
| 3 | 50 | 7.73 | 343.23 | 1413.54 | 85.35 |
| 10 | 1 | 7.79 | 5.81 | 78.53 | 11.82 |
| 10 | 10 | 7.51 | 52.84 | 848.60 | 22.14 |
| 10 | 50 | 7.25 | 241.75 | 4140.90 | 97.26 |
| 30 | 1 | 6.42 | 4.44 | 207.45 | 31.10 |
| 30 | 10 | 6.66 | 49.35 | 2279.40 | 24.53 |
| 30 | 50 | 7.14 | 322.56 | 12223.39 | 95.65 |

Raw measurements: `private-access-gateway-benchmark.json`. RSS peaks do not grow linearly with full object size: sampled deltas span roughly 12–97 MiB in this combined fixture process. This is bounded-streaming evidence, not a qualified serverless memory/throughput limit.

## Monthly cost model (illustrative marginal transfer, not invoice)

Inputs: T=active_tracks, L=monthly_listeners, p=plays_per_listener, d=average_track_duration, b=average_bitrate, B=average_bytes_delivered (including seeking/reload overlap), r=range_requests_per_play, q=database_checks_per_request (1 RPC), provider egress/compute tariffs. P=L*p, nominal O=d*b/8, retained playback storage≈T*O, delivery E=P*B/1e9 GB. Multiple share links add no playback storage. Let S be sessions/month, h the HEAD share of requests, Ccpu actual billed CPU hours, Cmem actual billed GB-hours, Ninv actual invocations.

Gateway cost = playback storage + Storage GET/request charges + E*(Storage egress + proxy-origin transfer + proxy-edge transfer) + DB cost(S*access RPCs + P*r*q) + Ccpu*CPU tariff + Cmem*memory tariff + Ninv*invocation tariff. Stream Storage GET count≈P*r*(1-h). Broker cost replaces proxy transfer/long-function compute with direct Storage/CDN delivery, retaining authorization/broker/DB costs. Session reuse means S need not equal P. Function duration depends on delivered throughput, not just track duration. CPU while active and memory while awaiting I/O must be priced separately; concurrent Fluid functions can share billed instance memory, so summing per-request RSS is invalid.

Official sources checked 2026-11-22:
- [Vercel streamed-body exception](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions): streamed responses avoid ordinary 4.5MB body limit; duration/network limits remain.
- [Vercel CDN usage](https://vercel.com/docs/manage-cdn-usage): illustrative on-demand Fast Data Transfer $0.15/GB, Fast Origin Transfer $0.06/GB, CDN requests $2/million; region/plan/Flat Rate CDN change actual charges.
- [Vercel Functions pricing](https://vercel.com/docs/functions/usage-and-pricing): regional examples iad1 CPU $0.128/hour, memory $0.0106/GB-hour; published invocation example $0.60/million is not a universal contractual quote. No provider CPU/GB-hours were measured here.
- [Supabase pricing](https://supabase.com/pricing) and [egress usage](https://supabase.com/docs/guides/platform/manage-your-usage/egress): Pro base $25, included uncached egress 250GB then $0.09/GB, cached egress 250GB then $0.03/GB. Do not assume cache hits for private direct URLs.

Assume B=measured 3min 4321488 bytes/play, no repeated-range overlap, no plan allowances/base fees/compute/request charges/tax. Compare marginal uncached Storage-only delivery $0.09/GB with Gateway transfer $0.09+$0.15+$0.06=$0.30/GB. This is a scenario, not a full monthly bill:

| Plays/month | GB delivered | Gateway transfer $ | Direct transfer $ | Added proxy transfer $ |
|---|---|---|---|---|
| 1000 | 4.321488 | 1.30 | 0.39 | 0.91 |
| 10000 | 43.214880 | 12.96 | 3.89 | 9.08 |
| 100000 | 432.148800 | 129.64 | 38.89 | 90.75 |
| 1000000 | 4321.488000 | 1296.45 | 388.93 | 907.51 |

For an explicitly hypothetical r=6 requests/play, streaming RPC count=6P, plus session authorization and any HEADs. Browser r was NOT measured. At 1m plays this can exceed current 100k requests/day budget; do not raise limits without native capacity evidence. Review broker/CDN trade-offs around 100k plays/month (about $91 marginal proxy transfer in this scenario), or earlier if the agreed budget/latency target is exceeded. Changing to signed delivery requires explicit acceptance of TTL-based revocation lag; no silent fallback.

## Reproduce and outstanding release gates

Fast SQL model: install @electric-sql/pglite in a disposable directory, set UNIT_PGLITE_MODULE to its absolute ESM module; run `node --test tests/audio/gateway/access.test.mjs tests/audio/gateway/streaming.test.mjs` and `node supabase/tests/asset-access/run.mjs`. This is PostgreSQL-WASM, not native Supabase. For actual loopback HTTP run `node --test tests/audio/gateway/http.test.mjs`; no cloud credentials. Benchmark `node tests/audio/gateway/benchmark.mjs` with FFMPEG_PATH and FFPROBE_PATH pointing to qualified binaries.

Native driver: `UNIT_AUDIO_GATEWAY_NATIVE_TEST=yes node supabase/tests/asset-access/disposable-local.mjs` additionally runs the real Auth/Storage/media-worker/gateway synthetic test inside a newly generated isolated local Supabase. Requires the pinned CLI, Docker Engine/Compose, FFmpeg and free local ports/disk; it refuses hosted targets. Native test is skipped unless explicitly enabled and generated credentials are supplied. No production key override exists.

Still BLOCKED: native Supabase GET/206/HEAD/Storage permission semantics and multiprocess shared limiter races, complete worker concurrency qualification from preceding PRs, real Safari/Chrome/Firefox/mobile cookie/seek/refresh tests under HTTPS, full Next Route Handler/provider streaming and abort behavior, regional Vercel load/billing/cold starts, least-privileged hosted DB/Storage credentials and trusted production ingress. Local HTTP fixture is not a Next server and Node cookie jar is not a browser. Webpack success alone cannot close these gates. Do not merge/activate/deploy real-user links until they close.

## Verification record

2026-11-22, no cloud DB calls/deployment:

- 43/43 automated tests PASS: 27 gateway SQL/Web API/streaming checks and 16 existing pipeline/FFmpeg/storage/queue checks; real FFmpeg/FFprobe binaries supplied explicitly.
- Separate real loopback HTTP integration: 1 PASS; native Supabase scenario 1 SKIPPED. SQL-WASM fixture uses synthetic Auth/Storage upstreams, not native products.
- All 27 migrations replayed in order; pre-existing asset field preservation, access isolation and backfill dry-run regression PASS.
- `npx tsc --noEmit`: PASS. Targeted ESLint new gateway/routes/tests: PASS.
- `npm run lint`: existing baseline 36 errors / 34 warnings, outside this change; not repaired.
- `npm run build`: FAIL on Turbopack internal PostCSS process port binding, OS EPERM; retry outside sandbox reproduces the same restriction.
- `npm run build -- --webpack`: PASS, including TypeScript and all 32 static pages. Build ran in an isolated HEAD snapshot with this change only, no .env.local and no unrelated next.config/Docker/health edits.
- Native disposable driver: BLOCKED at Docker prerequisite (`docker context` unavailable). No replacement with hosted Supabase, no bucket policy relaxation.

Commands (test-only temporary dependency location):

```sh
export UNIT_PGLITE_MODULE=/absolute/disposable/node_modules/@electric-sql/pglite/dist/index.js
export FFMPEG_PATH=/absolute/qualified/ffmpeg
export FFPROBE_PATH=/absolute/qualified/ffprobe
node --test tests/audio/gateway/access.test.mjs tests/audio/gateway/streaming.test.mjs tests/audio/queue.test.mjs tests/audio/storage.test.mjs tests/audio/processor.test.mjs
node --test tests/audio/gateway/http.test.mjs tests/audio/gateway/native.test.mjs
node supabase/tests/asset-access/run.mjs
```
