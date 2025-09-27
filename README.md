# Shielded ISR Multi-Tenant Platform

> [!NOTE]
> This project is experimental and all practices herein should be evaluated as such.

A three-app Next.js system providing shielded ISR caching for multi-tenant platforms on Vercel. The shield layer provides cache protection during Core app deployments, enabling cache warming and preventing slow first requests.

## Shielded ISR Architecture

"Normal" ISR (Incremental Static Regeneration) in Next.js caches pages tied to a deployment. When you deploy a new version, the ISR cache is invalidated and must be rebuilt, causing slow first requests for pages not generated during build.

**Shielded ISR** solves this by providing a protective cache layer that serves content while the Core app warms its cache after deployment. This enables:

- **Cache Warming**: Defer static page generation until after build, then prewarm by requesting each page
- **Deployment Protection**: Shield cache serves content while Core app ISR cache rebuilds
- **Performance**: Fast responses during the critical post-deployment period
- **Flexibility**: Generate pages on-demand rather than during build time

### Basic Shielded ISR Example

Here's how shielded ISR works in its simplest form:

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

  // Key: Set long-term cache with revalidation for shield protection
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

1. **Shield**: Proxies requests to your main application with protective caching
2. **CDN Caching**: 30-second revalidation with 1-year stale-while-revalidate
3. **Deployment Protection**: Shield cache serves content while Core app ISR rebuilds
4. **Cache Warming**: Pages can be generated on-demand after deployment

## Multi-Tenant Architecture

This project extends basic shielded ISR for multi-tenant platforms:

- **API** (Port 3002) - Content API with posts/authors endpoints
- **Core** (Port 3001) - Multi-tenant pages with subdomain routing and middleware, fetches from API
- **Shield** (Port 3000) - Protective proxy with CDN caching, shields Core app during deployments

```txt
User Request → Shield → Core App → API
```

For more detailed diagrams, see the [architecture docs](docs/ARCHITECTURE.md).

For a comparison with basic shielded ISR and the changes required for multi-tenant, see the [evolution docs](docs/EVOLUTION.md).

## Deployment Colors

The platform uses deterministic color generation for deployment identification. Each deployment ID and timestamp generates a unique color using SHA-256 hashing and HSL color space conversion.

### Purpose

- **Observability**: Identify which deployment served a request by color
- **Testing**: Verify cache behavior across different deployments
- **Debugging**: Distinguish how/when pages are being rendered and/or served from cache

## Deployment

### Prerequisites

Set environment variables in Vercel projects:

- `API_HOST`, `CORE_HOST`, `SHIELD_HOST`
- `NEXT_PUBLIC_PROTOCOL`, `NEXT_PUBLIC_ROOT_DOMAIN`
- `REDIS_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`

### Deploy Commands

```bash
# Deploy Core System (API + Core)
pnpm run deploy:core-system

# Deploy Shield independently
pnpm run deploy:shield

# Deploy everything
pnpm run deploy:all
```

### Deployment Boundaries

- **Core System**: Tightly coupled API + Core apps
- **Shield**: Independent protective proxy layer

## Environment Variables

### Required

```bash
API_HOST=api.yourteam.vercel.app
CORE_HOST=core.yourteam.vercel.app
SHIELD_HOST=shield.yourteam.vercel.app
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
