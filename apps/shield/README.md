# Shield

A caching proxy that provides shielded ISR protection for the Core app during deployments.

## What it does

- Rewrites tenant subdomain requests to Core's `/s/[subdomain]/...` routes via `vercel.ts`
- Sets Shield CDN cache headers on tenant routes (`s-maxage=120`, long `stale-while-revalidate`)
- Exposes `/api/invalidate` to delete Core cache tags and invalidate Shield CDN tags

## How it works

When Core deploys, its ISR cache is cleared. Shield's CDN cache is independent and keeps serving responses while Core rebuilds.

1. **Cache protection**: Shield CDN serves cached tenant pages after Core deploys
2. **Rewrites**: Platform routing in `vercel.ts` extracts the subdomain from the host and forwards to Core
3. **Invalidation**: `/api/invalidate` deletes the tag on Core first, then purges Shield CDN entries for that tag

See [architecture](/docs/ARCHITECTURE.md) for request flows and invalidation ordering.

## Environment variables

Copy `env.example` to `.env.local`:

- `CORE_HOST` — hostname of the Core deployment (used by `vercel.ts` rewrites)
- `VERCEL_TOKEN` — only needed for `pnpm deploy:shield`

`CORE_HOST` should match your Core deployment hostname (for example the host in `coreUrl` from `config/validation.json`).

## Development

```bash
pnpm dev
```

The Shield app runs on port 3000 by default. Local dev does not fully replicate platform rewrites; use deployed URLs for cache and routing validation.
