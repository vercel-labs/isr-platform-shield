# Shield

A caching proxy that provides shielded ISR protection for the Core app during deployments.

## What it does

- Rewrites tenant subdomain requests to Core's `/s/[subdomain]/...` routes via `vercel.ts`
- Sets Shield CDN cache headers on tenant routes (`s-maxage=120`, long `stale-while-revalidate`)
- Exposes authenticated `POST /api/shield/invalidate` for the legacy route-based invalidation comparison

## How it works

When Core deploys, its ISR cache is cleared. Shield's CDN cache is independent and keeps serving responses while Core rebuilds.

1. **Cache protection**: Shield CDN serves cached tenant pages after Core deploys
2. **Rewrites**: Platform routing in `vercel.ts` extracts the subdomain from the host and forwards to Core
3. **Invalidation**: `/api/shield/invalidate` deletes the tag on Core first, then invalidates Shield CDN entries for that tag

Preview tenants use `<tenant>---<shield-immutable-host>` so they remain one DNS label under the existing Preview suffix certificate.

See [architecture](/docs/ARCHITECTURE.md) for request flows and invalidation ordering.

## Environment variables

Copy `env.example` to `.env.local`:

- `CORE_HOST` — hostname of the Core deployment (used by `vercel.ts` rewrites and `@platform/config`)
- `SHIELD_HOST` — hostname of the Shield deployment (used by `@platform/config`)
- `NEXT_PUBLIC_ROOT_DOMAIN` — public root domain (used by `@platform/config`)
- `CACHE_CONTROL_TOKEN` — bearer token for the legacy invalidation route

Run PoC deployments from the repository root with the guarded `deploy:poc:*` commands.

## Development

```bash
pnpm dev
```

The Shield app runs on port 3000 by default. Local dev does not fully replicate platform rewrites; use deployed URLs for cache and routing validation.
