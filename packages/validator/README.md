# Validator

Integration tests for routing and cache behavior against deployed URLs.

Configuration lives in `config/validation.json` — see [config/README.md](/config/README.md).

## Usage

```bash
# From monorepo root
pnpm validate
pnpm validate:routing
pnpm validate:cache

# From this package
pnpm test
pnpm test routing.test.ts
pnpm test cache.test.ts
```
