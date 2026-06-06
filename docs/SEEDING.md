# Seeding tenant subdomains

This project stores **blog post content** in a static JSON file and **tenant subdomains** in Upstash Redis. There is no SQL database and no migration step — only Redis needs to be populated before subdomain routes and validation tests will work.

## What gets seeded

| Subdomain | Emoji | Source |
|-----------|-------|--------|
| Primary validation tenant | 🧊 | `subdomains.primary` in `config/validation.json` (default: `cool`) |
| Secondary validation tenant | 🧪 | `subdomains.secondary` in `config/validation.json` (default: `test`) |
| `demo` | 🚀 | Fixed example tenant |
| `acme` | 🏢 | Fixed example tenant |

Each entry is written to Redis as:

```json
{
  "emoji": "🧊",
  "createdAt": 1717603200000
}
```

under the key `subdomain:<name>` (for example, `subdomain:cool`).

Blog posts are **not** seeded. They always come from `apps/core/lib/data.json` and are shared across all tenants.

## Prerequisites

1. Run `pnpm setup` from the monorepo root.
2. Copy `apps/core/env.example` to `apps/core/.env.local`.
3. Set Upstash Redis credentials in `.env.local`:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`

The seed script reads credentials from `apps/core/.env.local`. Environment variables already set in your shell take precedence over values in the file.

## Run the seed script

From the monorepo root:

```bash
pnpm seed
```

Or, after setup has added `bin/` to your PATH:

```bash
seed-subdomains
```

From the Core app directory:

```bash
pnpm --filter @platform/core seed
```

### Options

```bash
pnpm seed -- --force
```

| Flag | Behavior |
|------|----------|
| *(none)* | Create missing subdomains; skip any that already exist in Redis |
| `--force` | Overwrite existing subdomain entries (preserves `createdAt` when updating) |
| `--help` | Print usage |

### Example output

```
create cool 🧊
create test 🧪
create demo 🚀
create acme 🏢
```

On a second run without `--force`:

```
skip cool (already exists)
skip test (already exists)
skip demo (already exists)
skip acme (already exists)
```

## Verify

Visit subdomain pages through your deployed Shield URL:

- `https://<subdomains.primary>.<rootDomain>/`
- `https://<subdomains.secondary>.<rootDomain>/`

(values from `config/validation.json`)

Or open the admin dashboard at `https://www.<rootDomain>/admin`.

Run validation once subdomains exist:

```bash
pnpm validate:cache
```

Cache tests expect the primary and secondary validation subdomains to be present in Redis. See [validation](/docs/VALIDATION.md) for details.

## Alternatives

You can create tenants manually instead of running the seed script:

- **Admin UI** — visit `/s/www/admin` and use the subdomain form (same Redis records as the seed script).
- **API path** — subdomain creation goes through the Core app's server action in `apps/core/app/s/www/actions.ts`.

The seed script is idempotent and intended for fresh environments, CI, and local dev setup.

## Troubleshooting

**Missing credentials**

```
Missing KV_REST_API_URL or KV_REST_API_TOKEN.
```

Copy `apps/core/env.example` to `apps/core/.env.local` and fill in your Upstash REST URL and token.

**Validation tests fail on subdomain pages**

Confirm the primary/secondary subdomains in `config/validation.json` match what exists in Redis. Re-run `pnpm seed` or create the missing tenants in the admin UI.

**Wrong subdomain names after changing validation config**

The seed script reads `subdomains.primary` and `subdomains.secondary` from `config/validation.json`. If you rename them in config, run `pnpm seed` to create the new entries. Old Redis keys are not removed automatically.
