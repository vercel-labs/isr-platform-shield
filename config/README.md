# Platform config

Copy `validation.example.json` to `validation.json` and edit your values. Or run `pnpm setup` from the repo root.

| Field | Used for |
|-------|----------|
| `rootDomain` | Public domain, subdomain suffix in Core, validation tests |
| `altDomain` | Alternate domain in cache/404 tests |
| `subdomains.primary` / `subdomains.secondary` | Tenants that must exist in Redis (`pnpm seed`) |
| `coreUrl` / `shieldUrl` | Deployment URLs for `bin/` helpers and tests |

TypeScript code imports via `@platform/config`:

```typescript
import { config, urls } from "@platform/config";
```
