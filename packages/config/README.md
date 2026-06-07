# @platform/config

Platform settings for Core, Shield, validator tests, and `bin/` helpers.

Copy `validation.example.json` to `validation.json` and edit your values. Or run `pnpm setup` from the repo root.

When `validation.json` is missing (for example on Vercel), the bundled `validation.example.json` is used. Local overrides go in gitignored `validation.json`.

| Field | Used for |
|-------|----------|
| `rootDomain` | Public domain, subdomain suffix in Core, validation tests |
| `altDomain` | Alternate domain in cache/404 tests |
| `subdomains.primary` / `subdomains.secondary` | Tenants that must exist in Redis (`pnpm seed`) |
| `coreUrl` / `shieldUrl` | Deployment URLs for `bin/` helpers and validator tests |

```typescript
import { config, urls, getConfig } from "@platform/config";
```
