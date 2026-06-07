# Core App

The main Next.js application that serves blog posts with subdomain support.

## What it does

- Displays blog posts from `lib/data.json`
- Supports custom subdomains for different tenants (routed via `/s/[subdomain]`)
- Shows individual blog post pages
- Provides subdomain-specific landing pages with random posts

## Pages

- `/s/www` - Main landing page
- `/s/[subdomain]` - Subdomain-specific page with random posts
- `/s/[subdomain]/[id]` - Individual blog post page
- `/s/www/admin` - Admin dashboard for managing subdomains

## Environment variables

Copy `env.example` to `.env.local`:

- `NEXT_PUBLIC_ROOT_DOMAIN` — public root domain (also read by `@platform/config`)
- `KV_REST_API_URL` — Upstash Redis REST URL (subdomain storage)
- `KV_REST_API_TOKEN` — Upstash Redis REST token

Validation subdomain names come from `packages/config/validation.json`. Domain and deployment URLs are resolved from env vars via `@platform/config`. See [packages/config/README.md](/packages/config/README.md).

`VERCEL_DEPLOYMENT_ID` is injected automatically on Vercel and is only used for debug UI.

## Development

```bash
pnpm dev
```

The core app runs on port 3001 by default.

## Data storage

| Data | Location |
|------|----------|
| Blog posts and authors | `lib/data.json` (static file, no seed step) |
| Tenant subdomains | Upstash Redis (`subdomain:<name>` keys) |

Subdomains can be created through the admin UI at `/s/www/admin` or seeded in bulk for dev and validation.

## Seed subdomains

From the monorepo root:

```bash
pnpm seed
```

This creates the validation tenants (`cool`, `test` by default — names come from `packages/config/validation.json`) plus example tenants `demo` and `acme`.

Requires `apps/core/.env.local` with `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Pass `--force` to overwrite existing entries:

```bash
pnpm seed -- --force
```

Full details: [docs/SEEDING.md](/docs/SEEDING.md).
