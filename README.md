# Shielded Platform ISR

> [!NOTE]
> This project is experimental and all practices herein should be evaluated as such.

A two-app Next.js system providing shielded ISR caching for multi-tenant platforms on Vercel. The shield layer provides cache protection during Core app deployments, enabling cache warming and preventing slow first requests.

## Before you start

Run the setup script: `pnpm setup`

This installs dependencies and injects the project `bin` dir into your PATH, which allows you to use validation helpers.

Copy `env.example` to `.env.local` in each app you run:

- **Core** (`apps/core`): `NEXT_PUBLIC_ROOT_DOMAIN`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`
- **Shield** (`apps/shield`): `CORE_HOST`, `SHIELD_HOST`, `NEXT_PUBLIC_ROOT_DOMAIN`

`@platform/config` reads those env vars for domain and deployment URLs. Subdomain names for validation live in `packages/config/validation.json` — copy from `validation.example.json` or run `pnpm setup`. See [packages/config/README.md](/packages/config/README.md).

Seed example tenant subdomains in Upstash Redis (required before cache validation and subdomain routes work):

```bash
pnpm seed
```

See [seeding](/docs/SEEDING.md) for prerequisites, what gets created, and troubleshooting.

## Shielded ISR Architecture

"Normal" ISR (Incremental Static Regeneration) in Next.js caches pages tied to a deployment. When you deploy a new version, the ISR cache is replaced and must be rebuilt, causing slow first requests for pages not generated during build.

**Shielded ISR** solves this by providing a protective cache layer that serves content while the Core app warms its cache (via active reading) after deployment. This enables:

- **Deferred prerendering**: Defer static page generation until after build, then pre-warm by requesting each page
- **Deployment Protection**: Shield cache serves content while Core app ISR cache rebuilds
- **Performance**: Fast responses during the critical post-deployment period

See the [architecture](/docs/ARCHITECTURE.md) and [data flow](/docs/DATA_FLOW.md) docs for more information.

## Validation

Run `pnpm validate:routing` for the existing routing checks and `pnpm validate:cache` for the existing cache checks.

The branch-only behavioral acceptance runner uses `pnpm validate -- --suite <ID> --environment preview|production`. It mutates fixture state and can purge explicitly targeted caches, so read the [behavioral acceptance guide](/docs/BEHAVIORAL_ACCEPTANCE.md) before running it.

See the [validation doc](/docs/VALIDATION.md) for the original checks.
