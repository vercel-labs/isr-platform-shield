# Shield behavioral acceptance PoC

This guide covers safe deployment and execution of the behavioral acceptance fixture on branch `poc/behavioral-acceptance`.

## Invariants

Shield stays CDN-only. Its PoC behavior is implemented with platform rewrites and response headers in `apps/shield/vercel.ts`. Do not add Middleware, Proxy, Vercel Functions, or application handlers to Shield for fixture routing. Core owns all fixture handlers and mutable state.

`CORE_HOST` is always a bare hostname such as a Vercel branch alias. It must never contain a scheme, path, query, fragment, credentials, or port. The deployment script supplies it to Shield at build time and runtime.

Preview Shield deployments point to the stable Core branch alias. They never point to an immutable Core deployment URL. A later Core-only deployment moves the Core branch alias while the fixed Shield deployment keeps using the same hostname.

Tenant previews use `https://<tenant>---<shield-immutable-host>`. Vercel routes this single-label hostname to the immutable Shield deployment, and Shield extracts the tenant before `---`. The deployment manifest and command output provide the exact template. Nested hosts such as `<tenant>.<shield-host>` are not used because they require another wildcard certificate level.

## Fixture route contract

The fixture is namespaced under `/__poc`:

| Method | Route | Contract |
| --- | --- | --- |
| `GET` | `/__poc/page/{path}` | Returns a default-profile marker and path-scoped `poc:` cache tags. |
| `GET` | `/__poc/profile/{path}` | Returns a profile marker selected by the `poc-profile` cookie and Shield's `x-content-profile` transform. |
| `POST` | `/__poc/control/status` | Reports the storage backend, environment, and deployment ID. |
| `POST` | `/__poc/control/bump` | Advances default or profile content versions for a path. |
| `POST` | `/__poc/control/fault` | Sets or clears a path-scoped delay or forced 500 response. |
| `POST` | `/__poc/control/revalidate` | Runs the fixture's namespaced `revalidateTag` operation. |
| `POST` | `/__poc/control/oidc-rest` | Probes Vercel REST authentication with the deployment OIDC token. |

Markers expose `renderId`, `contentVersion`, `profile`, `deploymentId`, `renderedAt`, `path`, and `tags`. Core applies the returned tags with `addCacheTag`. Control routes require a bearer token and return `Cache-Control: private, no-store` on success and failure.

Profile normalization uses three conditional CDN rewrite rules (`free`, `member`, and `enterprise`). The experiment tests whether `Vary: x-content-profile` keys the outer cache on the request header set by a routing rule. If the platform does not include that transformed header in the key, B3 fails without introducing request compute into Shield.

## Dashboard prerequisites

Complete these in the Vercel dashboard before deploying:

1. Confirm both projects are connected to `vercel-labs/isr-platform-shield`, with root directories `apps/core` and `apps/shield`.
2. Connect a Vercel Blob store to the Core project for each target used by the PoC. Deployed fixture state does not fall back to process memory. A missing Blob connection causes fixture reads and mutations to fail.
3. Configure the project environment variables listed below for Preview and, only when needed, Production.
4. Enable Vercel system environment variables on Core so `VERCEL_ENV`, `VERCEL_DEPLOYMENT_ID`, and OIDC context are present.
5. Confirm branch aliases are enabled and Preview deployment protection bypass credentials are available to Shield and the validator.
6. For dashboard-only acceptance evidence, arrange the required project roles and access to Audit Logs. The runner reports the role and audit scenario as `BLOCKED`; collect that evidence manually.

The Blob integration provides `BLOB_STORE_ID` or `BLOB_READ_WRITE_TOKEN`. Do not put either value in this document or a deployment manifest.

Local-only route testing can set `POC_ALLOW_MEMORY=1`. Never set it on Vercel; deployed fixture state fails closed when Blob or `VERCEL_ENV` is unavailable.

## Environment names

Set values in the dashboard or invoking shell. This list intentionally contains names only.

Core project:

- `POC_CONTROL_TOKEN`
- `CACHE_CONTROL_TOKEN`
- `POC_ALLOWED_PROJECT_IDS`
- `POC_VERCEL_TEAM_ID` or `POC_VERCEL_TEAM_SLUG`
- `BLOB_STORE_ID` or `BLOB_READ_WRITE_TOKEN`

Shield project:

- `NEXT_PUBLIC_ROOT_DOMAIN`
- `VERCEL_BYPASS_TOKEN`
- `CACHE_CONTROL_TOKEN`
- `CORE_HOST` (overridden by `bin/poc-deploy` for each Shield deployment)

Deployment shell:

- `VERCEL_TOKEN` is optional when the Vercel CLI is already logged in.
- `CORE_PRODUCTION_HOST` is required only when the script cannot safely discover the canonical Core production hostname. It must be a bare hostname.

Validator shell, as required by the selected scenarios:

- `PREVIEW_SHIELD_URL`, `PREVIEW_CORE_URL`
- `PRODUCTION_SHIELD_URL`, `PRODUCTION_CORE_URL`
- `SHIELD_URL`, `CORE_URL` as read-only fallbacks; destructive rows require environment-scoped URLs
- `POC_CONTROL_TOKEN`, `VERCEL_TOKEN`
- `CORE_PROJECT_ID`, `SHIELD_PROJECT_ID`
- `VERCEL_TEAM_ID` or `VERCEL_TEAM_SLUG`
- `SHIELD_BYPASS_TOKEN`, `CORE_BYPASS_TOKEN`
- `EXTERNAL_ORIGIN_SHIELD_URL`, `EXTERNAL_ORIGIN_SHIELD_PROJECT_ID`
- `EXTERNAL_ORIGIN_SHIELD_BYPASS_TOKEN`

Acceptance item B1.5 needs a second Shield fixture whose origin belongs to another team or an equivalent external-origin boundary. Directly requesting another-team content does not test propagation across a Shield rewrite.

## Safe deployment targets

No deployment command defaults to Production. `preview` and `production` are distinct Vercel deployment targets. The validator's `--environment` value is also sent as the REST cache mutation `target`; keep it aligned with the deployed URLs.

Every REST purge request must include `target` with the explicit value `preview` or `production`. This applies to soft invalidation and hard deletion. Hard deletion must also send `revalidationDeadlineSeconds: 0`.

The script rejects a dirty worktree by default. Use `--allow-dirty` only after reviewing the exact uncommitted changes. The generated manifest records the dirty state.

## Deployment commands

Run commands from the repository root.

Deploy Core first and then Shield to Preview:

```bash
pnpm deploy:poc:preview
```

Allow an intentionally dirty worktree:

```bash
pnpm deploy:poc:preview -- --allow-dirty
```

Deploy both projects to Production:

```bash
pnpm deploy:poc:production -- --confirm-production
```

Deploy only Core for a Preview deployment-survival check:

```bash
pnpm deploy:poc:core -- preview --pair-manifest .artifacts/deployments/<paired-preview-manifest>.json
```

Deploy only Core to Production:

```bash
pnpm deploy:poc:core -- production --pair-manifest .artifacts/deployments/<paired-production-manifest>.json --confirm-production
```

Inspect the current stable aliases without deploying:

```bash
./bin/poc-deploy status preview
./bin/poc-deploy status production
```

Each successful deployment writes a secret-free JSON manifest under `.artifacts/deployments/` and prints its path plus the stable Shield URL. A Core-only manifest records the existing Shield deployment with `deployed: false`.

Core-only deployment requires the successful paired manifest so the script can prove the fixed Shield deployment was built against the stable Core hostname. Failed or partial deployments also write a manifest with `outcome: "failed"`.

`deploy:all` is retained as a safe Preview alias. Use the explicit PoC scripts above for acceptance work.

## Run the validator

Run the stop gate first:

```bash
pnpm validate -- --suite B1.1 --environment preview --runs 3 --output .artifacts/evidence/b1-1-preview
```

B1.1 isolates Core deletion from Shield invalidation with separate paths that omit and include `x-vercel-debug-proxy-timing`. In the observed Preview fixture, Core hard deletion changed the outer Shield entry to delayed `REVALIDATED` with fresh content in all six variants. After the refreshed Shield entry settled, Shield soft invalidation produced no transition from `HIT` during the five-second observation window. The result is classified as an architecture change because Core deletion removed the Shield stale fallback before Shield invalidation ran.

Run one section or the full suite serially:

```bash
pnpm validate -- --suite B1 --environment preview --runs 3 --output .artifacts/evidence/b1-preview
pnpm validate -- --suite all --environment preview --runs 3 --output .artifacts/evidence/all-preview
pnpm validate -- --suite all --environment production --runs 3 --output .artifacts/evidence/all-production
```

The output path is a base directory. Each invocation creates a unique child directory so reruns cannot overwrite earlier evidence. B5.6 mutates both environments and additionally requires `--confirm-cross-environment`.

Run local checks without calling deployed mutation endpoints:

```bash
pnpm validate:routing
pnpm validate:cache
pnpm --filter validator typecheck
```

The runner executes selected scenarios in scenario-number order and runs repeated observations serially. Selecting a dependent B1 or B2 scenario automatically includes B1.1. If B1.1 is `FAIL` or `BLOCKED`, stop the acceptance run; the runner blocks the remaining dependent B1 and B2 scenarios. Resolve the fixture, alias, Blob, or protection problem before running mutating sections.

For deployment-survival evidence, keep this order:

1. Deploy the full Preview pair.
2. Run B1.1 and record the Shield and Core deployment markers.
3. Run the relevant warm-cache observation.
4. Run `pnpm deploy:poc:core -- preview --pair-manifest <manifest-from-step-1>`; this must not deploy Shield.
5. Repeat the observation through the same stable Shield URL and retain both deployment manifests with the validator evidence.

## Production caveat

Production deployment and validation can move live aliases, mutate fixture state, and purge Production cache entries. Run the Preview stop gate and relevant scenarios first. Production is allowed from `poc/behavioral-acceptance` only through an explicit Production command with `--confirm-production`; the flag confirms intent, not correctness.
