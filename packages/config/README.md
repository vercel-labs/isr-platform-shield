# @platform/config

TypeScript loader for [`config/validation.json`](../../config/validation.json) at the repo root. See [config/README.md](../../config/README.md) for the schema.

```typescript
import { config, urls, getConfig, tryGetConfig } from "@platform/config";
```

Do not add a `validation.json` to this package — the single config file lives in `config/`.
