# Durable ISR Multi-Tenant Platform

> [!NOTE]
> This project is experimental and all practices herein should be evaluated as such.

A three-app Next.js system providing durable ISR caching for multi-tenant platforms on Vercel. The cache layer survives Core app deployments, enabling independent scaling and true cache durability.

## Durable ISR Architecture

"Normal" ISR (Incremental Static Regeneration) in Next.js caches pages tied to a deployment. When you deploy a new version, the ISR cache is invalidated and must be rebuilt.

**Durable ISR** solves this by separating the cache layer from your application layer. Static pages are generated and persisted across deployments, providing:

- **Cache Persistence**: Pages remain cached even after new deployments
- **Independent Scaling**: Cache and application layers can be deployed separately
- **Cost Efficiency**: Reduced cold starts and faster response times
- **Reliability**: Stale content serves while new content regenerates

### Basic Durable ISR Example

Here's how durable ISR works in its simplest form:

```typescript
// ./app/[...slug]/route.ts
export async function GET(request: NextRequest, { params }) {
  const { slug } = await params;

  // Fetch from upstream application
  const pageResponse = await fetch(
    `https://upstream-project-url.vercel.app/${slug.join("/")}`
  );

  // Clean headers and set durable cache control
  pageResponse.headers.delete("transfer-encoding");
  pageResponse.headers.delete("content-encoding");
  pageResponse.headers.delete("content-length");

  // Key: Set long-term cache with revalidation
  pageResponse.headers.set(
    "vercel-cdn-cache-control",
    "s-maxage=30, stale-while-revalidate=31556952"
  );
  pageResponse.headers.set("x-proxied", "1");

  return pageResponse;
}
```

```typescript
// ./next.config.ts
const nextConfig: NextConfig = {
  rewrites: async () => {
    return {
      beforeFiles: [
        {
          source: "/:path*",
          destination: "https://upstream-project-url.vercel.app/:path*",
          missing: [
            {
              type: "header",
              key: "Sec-Fetch-Mode",
              value: "navigate",
            },
          ],
        },
      ],
    };
  },
};
```

### How it works

1. **Cache Layer**: Proxies requests to your main application
2. **CDN Caching**: 30-second revalidation with 1-year stale-while-revalidate
3. **Deployment Independence**: Cache survives when you deploy your main app
4. **Automatic Fallback**: Serves stale content if upstream fails

## Multi-Tenant Architecture

This project extends basic durable ISR for multi-tenant platforms:

- **API** (Port 3002) - Content API with posts/authors endpoints
- **Core** (Port 3001) - Multi-tenant pages with subdomain routing and middleware, fetches from API
- **Cache Layer** (Port 3000) - Durable proxy with CDN caching, survives Core deployments

```txt
User Request → Cache Layer → Core App → API
```

For more detailed diagrams, see the [architecture docs](docs/ARCHITECTURE.md).

For a comparison with basic durable ISR and the changes required for multi-tenant, see the [evolution docs](docs/EVOLUTION.md).

## Deployment Colors

The platform uses deterministic color generation for deployment identification. Each deployment ID and timestamp generates a unique color using SHA-256 hashing and HSL color space conversion.

### Purpose

- **Observability**: Identify which deployment served a request by color
- **Testing**: Verify cache behavior across different deployments
- **Debugging**: Distinguish how/when pages are being rendered and/or served from cache

## Deployment

### Prerequisites

Set environment variables in Vercel projects:

- `API_HOST`, `CORE_HOST`, `CACHE_LAYER_HOST`
- `NEXT_PUBLIC_PROTOCOL`, `NEXT_PUBLIC_ROOT_DOMAIN`
- `REDIS_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`

### Deploy Commands

```bash
# Deploy Core System (API + Core)
pnpm run deploy:core-system

# Deploy Cache Layer independently
pnpm run deploy:cache-layer

# Deploy everything
pnpm run deploy:all
```

### Deployment Boundaries

- **Core System**: Tightly coupled API + Core apps
- **Cache Layer**: Independent durable proxy layer

## Environment Variables

### Required

```bash
API_HOST=api.yourteam.vercel.app
CORE_HOST=core.yourteam.vercel.app
CACHE_LAYER_HOST=cache.yourteam.vercel.app
NEXT_PUBLIC_PROTOCOL=https
NEXT_PUBLIC_ROOT_DOMAIN=yourcoolsite.com
REDIS_URL=rediss://default:xxx@yyy-123.upstash.io:6379
KV_REST_API_URL=https://yyy-123.upstash.io
KV_REST_API_TOKEN=xxx
KV_REST_API_READ_ONLY_TOKEN=xxx
```

### Vercel Authentication

```bash
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_org_id
```
