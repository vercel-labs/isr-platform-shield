# Durable ISR Multi-Tenant Platform

A three-app Next.js system providing durable ISR caching for multi-tenant platforms on Vercel. The cache layer survives Core app deployments, enabling independent scaling and true cache durability.

## Architecture

- **API** (Port 3002) - Content API with posts/authors endpoints
- **Core** (Port 3001) - Multi-tenant pages with subdomain routing, fetches from API
- **Cache Layer** (Port 3000) - Durable proxy with CDN caching, survives Core deployments

```
User Request → Cache Layer → Core App → API
```

## Color System

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
# Check environment variables
pnpm run deploy:check

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
API_HOST=api.yourdomain.com
CORE_HOST=core.yourdomain.com
CACHE_LAYER_HOST=cache.yourdomain.com
NEXT_PUBLIC_PROTOCOL=https
NEXT_PUBLIC_ROOT_DOMAIN=yourdomain.com
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

## Operational Concerns

### Cache Durability

- Cache layer survives Core System deployments
- 1-hour CDN cache, 60-second ISR revalidation
- Independent scaling of cache and core systems

### Multi-Tenant Routing

- Subdomain-based: `tenant.example.com` → `/s/tenant`
- Redis storage for tenant data
- Shared infrastructure with tenant isolation

### Troubleshooting

- Core System must deploy before Cache Layer can proxy to it
  - After initial deployment, either system can be deployed independently
