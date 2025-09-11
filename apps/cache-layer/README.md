# Cache Layer

A Next.js caching proxy that sits in front of the core app to provide CDN-level caching.

## What it does

- Proxies requests to the core app
- Adds CDN cache headers (1 hour TTL)
- Removes Vercel-specific headers
- Provides static caching for better performance

## How it works

All requests are forwarded to the core app with `force-cache` enabled, then the response is modified to add proper CDN caching headers before being returned to the client.

## Development

```bash
npm run dev
```

The cache layer runs on port 3000 by default.