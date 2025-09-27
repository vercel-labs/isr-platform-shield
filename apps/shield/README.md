# Shield

A Next.js caching proxy that provides shielded ISR protection for the core app during deployments.

## What it does

- Proxies requests to the core app with protective caching
- Adds CDN cache headers (1 hour TTL) for deployment protection
- Removes Vercel-specific headers
- Provides cache warming capabilities for post-deployment performance
- Shields the core app from slow first requests after deployment

## How it works

The shield layer addresses the problem where ISR cache is purged on each new deployment, causing slow first requests for pages not generated during build. The shield:

1. **Cache Protection**: Serves cached content while Core app ISR cache rebuilds after deployment
2. **Cache Warming**: Allows deferring static page generation until after build, then prewarming by requesting each page
3. **Performance**: Prevents slow first requests during the critical post-deployment period

All requests are forwarded to the core app with `force-cache` enabled, then the response is modified to add proper CDN caching headers before being returned to the client.

## Development

```bash
npm run dev
```

The cache layer runs on port 3000 by default.
