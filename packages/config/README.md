# @platform/config

Shared deployment URL configuration for validation tests and `bin/` helpers.

## Setup

```bash
cp packages/config/validation.example.json packages/config/validation.json
```

Or run `pnpm setup` from the monorepo root.

## Configuration

Edit `packages/config/validation.json`:

- `rootDomain` — public domain served through Shield
- `altDomain` — alternate domain used in some cache/404 tests
- `subdomains.primary` / `subdomains.secondary` — tenant subdomains that must exist in Redis (seed with `pnpm seed`; see [seeding](/docs/SEEDING.md))
- `coreUrl` — Core app base URL
- `shieldUrl` — Shield app base URL

Environment variables override any JSON value:

- `VALIDATION_CONFIG` — path to a custom config file
- `VALIDATION_ROOT_DOMAIN`
- `VALIDATION_ALT_DOMAIN`
- `VALIDATION_SUBDOMAIN_PRIMARY`
- `VALIDATION_SUBDOMAIN_SECONDARY`
- `VALIDATION_CORE_URL`
- `VALIDATION_SHIELD_URL`

## Usage

```typescript
import { config, urls, loadValidationConfig } from "@platform/config";
```

CLI (used by `bin/` scripts):

```bash
node packages/config/cli.mjs coreUrl
```
