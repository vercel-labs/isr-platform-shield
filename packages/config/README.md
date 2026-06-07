# @platform/config

Platform settings for Core, Shield, validator tests, and `bin/` helpers.

## Resolution order

1. **App env vars** (used on Vercel and in `.env.local`)
2. **`validation.json`** local override (gitignored, optional)
3. **`validation.example.json`** bundled fallback

| Env var | Config field |
|---------|--------------|
| `NEXT_PUBLIC_ROOT_DOMAIN` | `rootDomain` |
| `CORE_HOST` | `coreUrl` |
| `SHIELD_HOST` | `shieldUrl` |
| `ALT_DOMAIN` | `altDomain` |

Subdomain names for validation (`subdomains.primary`, `subdomains.secondary`) come from JSON only.

Copy `validation.example.json` to `validation.json` to override subdomain names locally. Or run `pnpm setup` from the repo root.

```typescript
import { config, urls, getConfig } from "@platform/config";
```

See `apps/core/env.example` and `apps/shield/env.example` for the env vars each app expects.
