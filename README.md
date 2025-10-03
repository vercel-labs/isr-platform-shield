# Shielded Platform ISR

> [!NOTE]
> This project is experimental and all practices herein should be evaluated as such.

A two-app Next.js system providing shielded ISR caching for multi-tenant platforms on Vercel. The shield layer provides cache protection during Core app deployments, enabling cache warming and preventing slow first requests.

## Before you start

Run the setup script: `pnpm setup`

This installs dependency and injects the project `bin` dir into your PATH, which allows you to use valdation helpers.

## Shielded ISR Architecture

"Normal" ISR (Incremental Static Regeneration) in Next.js caches pages tied to a deployment. When you deploy a new version, the ISR cache is invalidated and must be rebuilt, causing slow first requests for pages not generated during build.

**Shielded ISR** solves this by providing a protective cache layer that serves content while the Core app warms its cache (via active reading) after deployment. This enables:

- **Deferred prerendering**: Defer static page generation until after build, then pre-warm by requesting each page
- **Deployment Protection**: Shield cache serves content while Core app ISR cache rebuilds
- **Performance**: Fast responses during the critical post-deployment period

See the [architecture](/docs/ARCHITECTURE.md) and [data flow](/docs/DATA_FLOW.md) docs for more information.

## Validation

Validating deployment behavior is done through the `validator` package. You can run `pnpm validate` from the root of the monorepo to test whether certain requests are being routed to the correct pages.

See the [validation doc](/docs/VALIDATION.md) for more details.