# Shield behavioral validator

The validator runs the B1-B6 behavioral acceptance experiments serially against deployed Core and Shield fixtures. It writes request evidence as JSONL and keeps long stateful experiments out of Jest.

## Run a suite

From the repository root:

```bash
pnpm validate -- --suite B1.1 --environment preview --runs 3 --output packages/validator/evidence/b1-1-preview
pnpm validate -- --suite B2 --environment preview --runs 3 --output packages/validator/evidence/b2-preview
pnpm validate -- --suite B3.1,B3.5 --environment preview --output packages/validator/evidence/profiles
```

From `packages/validator`:

```bash
pnpm validate --suite B1 --environment preview --runs 3
```

Selectors accept `smoke`, `all`, a section such as `B4`, one ID, a comma-separated list, or repeated `--suite` arguments. `smoke` runs only B1.1, the propagation stop gate.

The CLI requires `--environment preview|production` before any fixture mutation or REST cache operation. The selected value is sent as the explicit REST `target`; the runner never defaults a cache target. B5.6 deliberately sends both `preview` and `production` targets and requires `--confirm-cross-environment`.

B1, B2, and B4 timing experiments need `--runs 3` for `observed 3x` confidence. Smaller runs remain usable but their summary states that timing evidence is below the three-run minimum.

The process exits with status 0 for PASS, 1 when any row fails, and 2 when the run is blocked or invalid.

## Configure URLs and credentials

Environment-scoped URLs are mandatory for destructive scenarios. Unscoped fallbacks are accepted only for read-only rows:

- `PREVIEW_SHIELD_URL` or `PRODUCTION_SHIELD_URL`, then `SHIELD_URL`
- `PREVIEW_CORE_URL` or `PRODUCTION_CORE_URL`, then `CORE_URL`

Set these variables only when selected rows require them:

- `POC_CONTROL_TOKEN` authenticates Core controls through Shield.
- `VERCEL_TOKEN` authenticates Vercel REST calls.
- `CORE_PROJECT_ID` and `SHIELD_PROJECT_ID` select cache projects.
- `VERCEL_TEAM_ID` or `VERCEL_TEAM_SLUG` scopes REST calls.
- `SHIELD_BYPASS_TOKEN` and `CORE_BYPASS_TOKEN` pass Deployment Protection where the experiment allows credentials.
- `VERCEL_API_URL` overrides `https://api.vercel.com` for a local API double.

B1.5 cannot use a direct other-team URL because that would not test propagation through a Shield rewrite. It needs a separately deployed, controllable second-team Shield/Core pair and REST scope before it can be automated.

B5.6 requires all four explicit URLs:

- `PREVIEW_SHIELD_URL` and `PREVIEW_CORE_URL`
- `PRODUCTION_SHIELD_URL` and `PRODUCTION_CORE_URL`

Optional timing controls are:

- `POC_REQUEST_TIMEOUT_MS`, default 20000
- `POC_POLL_TIMEOUT_MS`, default 90000
- `POC_POLL_INTERVAL_MS`, default 400
- `POC_B2_REQUEST_INTERVAL_MS`, default 1000
- `POC_INVALIDATION_GAP_MS`, default 2000
- `POC_FAULT_DELAY_MS`, default 1500

## Numeric versions

`contentVersion` is an integer. Each scenario derives a deterministic per-row and per-run base above one million, then sends strictly increasing values to `control/bump`. Profile versions are also increasing integers.

The three profiles are fixed to `free`, `member`, and `enterprise`. They are not configurable.

## CDN-only profile architecture

Shield intentionally runs no Middleware, Proxy, application handler, or Vercel Function for profile routing. Conditional `vercel.ts` CDN rewrite rules convert `poc-profile=free|member|enterprise` into `x-content-profile`; profile responses include `Vary: x-content-profile`.

Core applies `addCacheTag` with a 60-second inner TTL. Shield is an external CDN rewrite with a 30-second outer TTL.

B3.5 records this route-derived normalization as an architectural caveat. A middleware-derived profile design is incompatible with the requirement that Shield remain CDN-only.

## Scenario rows

### B1: Invalidation propagation

- B1.1, **Shield-project REST invalidate propagated tag after warm+bump**. Warms v1, bumps v2, hard-deletes the Core test tag as freshness setup, then soft-invalidates Shield. It accepts an operation-caused `STALE` or `REVALIDATED` transition and requires eventual v2. `REVALIDATED` is recorded as a caveat because it is synchronous. This is the B1/B2 stop gate.
- B1.2, **Core-project REST invalidate only while Shield is fresh**. Requires Shield to remain on v1 and records direct Core behavior separately.
- B1.3, **Core-side Next revalidateTag and updateTag**. Automates `revalidateTag`; the row remains BLOCKED because no safe `updateTag` Server Action transport exists.
- B1.4, **Trace refresh mechanism via outer headers + renderId/contentVersion**. Records outer cache headers and marker changes. Definitive inner HIT/MISS attribution requires out-of-band Core logs.
- B1.5, **Same experiment across another team/external origin**. Remains BLOCKED until a separately deployed Shield/Core pair, second-team REST scope, and controllable Core freshness preparation are supplied.

### B2: Ordering and stale windows

- B2.1 warms v1, bumps v2, soft-invalidates Core then Shield, and issues ten requests over about ten seconds. Reproduction and non-reproduction of old-content re-pinning are both valid findings.
- B2.2 hard-deletes Core then soft-invalidates Shield. Initial stale v1 is allowed; v1 must never reappear after v2 is observed.
- B2.3 soft-invalidates Shield, waits `POC_INVALIDATION_GAP_MS`, records a request inside the gap, then hard-deletes Core and measures convergence.
- B2.4 emits a known-semantics table and marks fixture-observed cells. It is BLOCKED when the invocation has no B1/B2 operation evidence.

### B3: Profile variants

- B3.1 performs 300 requests: three profiles by five pages by twenty deterministic randomized/interleaved repetitions. Any cross-serve fails.
- B3.2 checks repeated outer HIT behavior for every profile.
- B3.3 checks the cookie sequence free -> member -> free and requires reuse of the original free render.
- B3.4 invalidates the enterprise-specific tag and requires enterprise to change while free remains unchanged.
- B3.5 requires exactly fifteen distinct cached render IDs, one for every profile/page combination, and verifies every combination reuses its render.

### B4: Failure behavior

- B4.1 calls only a safely invalid Core project. A 403/404 records `shieldCalled: false`; no real Shield project ID is supplied to this failure probe.
- B4.2 injects an origin 500 during Shield SWR refresh, requires the stale last-good response, clears the fault, and checks recovery.
- B4.3 hard-deletes Core and Shield while the origin returns 500, then reports the user status, body evidence, latency, cache state, and marker without forcing an expected result.
- B4.4 runs canonical operations over four paths while page3 fails. Pages 1, 2, and 4 must flip; page3 must retain its last-good render. The row reports successful render timestamp spread.
- B4.5 sends 25 concurrent requests after a hard-delete experiment and another 25 after a soft-invalidate experiment. It reports render ID cardinality and does not treat near-one cardinality as a platform guarantee.

### B5: Security and supported interfaces

- B5.1 requires a direct Core request without credentials to return Deployment Protection status 401/403.
- B5.2 probes unauthenticated bump, fault, revalidate, oidc-rest, Core `/api/delete`, and Shield `/api/shield/invalidate`. A Deployment Protection interception at Core is recorded separately from app-route authorization.
- B5.3 automates the shared control secret and configured protection bypass. Trusted-source dashboard/OIDC policy proof remains BLOCKED.
- B5.4 runs `oidc-rest` and records the exact upstream status/body. Any reached upstream status is an observation; rejection is not hard-coded as the only pass.
- B5.5 performs the canonical B2.2 sequence only through Vercel REST. The evidence includes a proof row with no `/api/delete` or `/api/shield/invalidate` call.
- B5.6 mutates Preview and Production independently, sends explicit REST targets in both directions, and requires the opposite environment's entry to remain unchanged.

### B6: Deployment and observability evidence

- B6.1 consumes pre/post evidence and `poc-deploy` manifests. It requires a Core-only deployment, the old cached render after deploy, and a request-triggered marker from the new Core deployment.
- B6.2 consumes the same checkpoint format around a Shield deployment and reports whether the warm render survived or changed.
- B6.3 records the CDN-only source design. Runtime middleware invocation proof requires structured o11y evidence.
- B6.4 requires structured MISS log/o11y evidence; response timing alone cannot prove MISS cost.

B6.1 and B6.2 require typed request-event JSONL and successful deployment manifests. Events must include timestamp, URL, cache status, scenario/run identity, and `parsedMarker`; the runner verifies stable Shield hosts, deployment completion times, target, branch, and request order.

Required paths are:

- `B6_PRE_EVIDENCE_PATH` and `B6_POST_EVIDENCE_PATH`, JSON or JSONL containing request events with `parsedMarker`
- `B6_PRE_MANIFEST_PATH` and `B6_POST_MANIFEST_PATH`, manifests produced by `bin/poc-deploy`

B6.3 accepts `B6_MIDDLEWARE_O11Y_PATH` containing the target, Shield deployment ID, observation window, and `shieldMiddlewareInvocations: 0`. B6.4 accepts `B6_MISS_O11Y_PATH` containing the target, deployment ID, `cacheStatus: "MISS"`, request ID, and finite non-negative MISS/origin durations. Missing evidence produces a precise BLOCKED row. B6 rows consume each checkpoint bundle once even when the wider invocation uses `--runs 3`.

## REST invariants

All cache calls use these Vercel endpoints directly:

- `POST /v1/edge-cache/invalidate-by-tags`
- `POST /v1/edge-cache/dangerously-delete-by-tags`

Every request body contains an explicit `target`. Every hard-delete body also contains `revalidationDeadlineSeconds: 0`.

The canonical orchestrator hard-deletes Core first and calls Shield soft invalidation only after Core succeeds. B4.1 emits `canonical.abort` evidence with `shieldCalled: false` when Core fails.

## Evidence

Each `--output` value is a base directory. The runner creates a unique invocation child directory and refuses to replace an existing event stream. Each invocation directory contains:

- `events.jsonl`, one sanitized event for every request, operation, experiment report, and row result
- `summary.json`, aggregate status and one result per selected row

Request evidence includes timestamp, scenario, run, URL, method, cookie names and profile, status, latency, `x-vercel-cache`, `x-vercel-id`, `age`, cache-control headers, `Vary`, parsed marker, operation metadata, and sanitized body. Authorization, bypass values, JWTs, and credential-shaped fields are redacted.

Each summary row has:

- Result `disposition`: `PASS`, `FAIL`, or `BLOCKED`
- Proposal `proposalDisposition`: `documentable`, `documentable-with-caveat`, `escalate-to-sign-off`, `architecture-change`, or `undetermined`
- `confidence`: `observed 3x`, `observed once`, `failed`, or `blocked`

Blocked rows always use proposal disposition `undetermined`.

## Legacy validation

The existing Jest checks remain separate:

```bash
pnpm validate:legacy
pnpm validate:routing
pnpm validate:cache
```

Type-check the CLI without deployed calls:

```bash
pnpm typecheck
```
