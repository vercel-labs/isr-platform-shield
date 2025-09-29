# Shielded ISR Multi-Tenant Architecture

A comprehensive guide to the shielded ISR multi-tenant platform architecture, including system capabilities, request flows, cache strategies, and deployment protection mechanisms.

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Core Capabilities](#core-capabilities)
4. [Request Flow Diagrams](#request-flow-diagrams)
5. [Cache Strategy & Pre-warming](#cache-strategy--pre-warming)
6. [Multi-Tenant Routing](#multi-tenant-routing)
7. [System Components](#system-components)
8. [Performance Characteristics](#performance-characteristics)
9. [Deployment & Maintenance](#deployment--maintenance)
10. [Configuration](#configuration)

## Overview

The Shielded ISR Multi-Tenant Platform is a sophisticated architecture that solves the critical problem of cache invalidation during deployments in multi-tenant applications. The system provides:

- **Cache Protection**: Serves cached content while Core app ISR cache rebuilds after deployment
- **Cache Pre-warming**: Enables safe cache warming after deployment without serving stale content
- **Multi-Tenant Support**: Subdomain-based tenant isolation with dynamic routing
- **Performance Optimization**: Multi-layer caching with intelligent cache strategies
- **Deployment Safety**: Prevents slow first requests during critical post-deployment periods

### The Problem This Solves

Traditional ISR (Incremental Static Regeneration) has a fundamental limitation: when you deploy a new version of your application, all ISR caches are purged. This means:

1. **Slow First Requests**: Pages must be rendered at runtime before they can be served from cache
2. **Poor User Experience**: Instability during the post-deployment cache warming period
3. **Multi-Tenant Complexity**: Subdomain routing adds additional cache complexity

### The Solution

The Shielded ISR architecture introduces a protective cache layer that:

- **Protects During Deployments**: Serves cached static content while Core app rebuilds
- **Enables Safe Pre-warming**: Allows cache warming after deployment without user impact
- **Maintains Performance**: Multi-layer caching ensures optimal response times
- **Supports Multi-Tenancy**: Handles complex subdomain routing with cache efficiency

## System Architecture

```mermaid
graph LR
    U[Users] --> S[Shield Layer<br/>Port 3000]
    S --> C[Core Layer<br/>Port 3001]
    C --> D[Data Layer]

    subgraph S
        MW[Middleware]
        CDN1[CDN Cache]
        ISR1[ISR Cache]
        RT1[Runtime]
    end

    subgraph C
        CDN2[CDN Cache]
        ISR2[ISR Cache]
        RT2[Runtime]
    end

    subgraph D
        R[Redis]
        FS[File System]
    end

    MW --> CDN1 --> ISR1 --> RT1
    CDN2 --> ISR2 --> RT2
    RT2 --> R
    RT2 --> FS

    classDef shield fill:#1976d2,color:#fff
    classDef core fill:#7b1fa2,color:#fff
    classDef data fill:#388e3c,color:#fff

    class MW,CDN1,ISR1,RT1 shield
    class CDN2,ISR2,RT2 core
    class R,FS data
```

## Core Capabilities

### 1. Cache Protection During Deployments

The Shield layer provides a protective cache that remains available even when the Core app's ISR cache is purged during deployment. This ensures users never experience slow page loads due to cache misses, maintaining consistent performance throughout the deployment process.

### 2. Safe Cache Pre-warming

The system enables a sophisticated cache warming strategy that allows safe pre-warming after deployment without serving stale content:

1. **Phase 1**: Deploy Core app (ISR cache is empty)
2. **Phase 2**: Pre-warm cache by making requests to Shield layer
3. **Phase 3**: Shield serves cached content while Core ISR rebuilds

This approach eliminates the traditional problem where cache warming could serve outdated content to users.

### 3. Multi-Tenant Subdomain Routing

Middleware extracts subdomains and rewrites URLs to tenant-specific paths, enabling isolated multi-tenant experiences while maintaining cache efficiency. Each tenant's content is served from their dedicated subdomain with proper URL rewriting and cache isolation.

### 4. Admin Panel Protection

Admin pages are only accessible from the root domain, with subdomain requests to admin paths automatically redirected to the root domain. This ensures administrative functions remain secure and isolated from tenant-specific content.

## Request Flow Diagrams

### Root Domain Landing Page

**Question**: How does a user request to the root domain get processed?

```mermaid
sequenceDiagram
    participant U as User
    participant MW as Shield Middleware
    participant CDN as Shield CDN
    participant ISR as Shield ISR
    participant RT as Shield Runtime
    participant CORE as Core App
    participant CORE_ISR as Core ISR
    participant CORE_RT as Core Runtime

    U->>MW: GET example.com/
    MW->>MW: Parse hostname (no subdomain)
    MW->>CDN: Check CDN Cache (1h TTL)

    alt Cache Hit
        CDN-->>U: Return Cached Response (~50ms)
    else Cache Miss
        CDN->>ISR: Check ISR Cache
        alt ISR Hit
            ISR-->>CDN: Return Cached Page
            CDN-->>U: Return Response (~100ms)
        else ISR Miss
            CDN->>RT: Generate Page
            RT->>CORE: Rewrite to Core App
            CORE->>CORE_ISR: Check Core ISR Cache
            alt Core ISR Hit
                CORE_ISR-->>CORE: Return Cached Page
            else Core ISR Miss
                CORE->>CORE_RT: Generate Page (Runtime)
                CORE_RT-->>CORE: Return Generated Page
                CORE->>CORE_ISR: Store in Core ISR Cache
            end
            CORE-->>RT: Return Page
            RT->>ISR: Store in Shield ISR Cache
            RT-->>CDN: Return Page
            CDN-->>U: Return Response (~300ms)
        end
    end
```

### Subdomain Tenant Page

**Question**: How does a subdomain request get routed to the correct tenant?

```mermaid
sequenceDiagram
    participant U as User
    participant MW as Shield Middleware
    participant CDN as Shield CDN
    participant ISR as Shield ISR
    participant RT as Shield Runtime
    participant CORE as Core App
    participant CORE_ISR as Core ISR
    participant CORE_RT as Core Runtime
    participant R as Redis

    U->>MW: GET tenant.example.com/
    MW->>MW: Extract subdomain "tenant"
    MW->>CDN: Check CDN Cache (1h TTL)

    alt Cache Hit
        CDN-->>U: Return Cached Response (~50ms)
    else Cache Miss
        CDN->>ISR: Check ISR Cache
        alt ISR Hit
            ISR-->>CDN: Return Cached Page
            CDN-->>U: Return Response (~100ms)
        else ISR Miss
            CDN->>RT: Generate Page
            RT->>CORE: Rewrite to /s/tenant
            CORE->>CORE_ISR: Check Core ISR Cache
            alt Core ISR Hit
                CORE_ISR-->>CORE: Return Cached Page
            else Core ISR Miss
                CORE->>CORE_RT: Generate Page (Runtime)
                CORE_RT->>R: Fetch Tenant Data
                R-->>CORE_RT: Return Tenant Data
                CORE_RT-->>CORE: Return Generated Page
                CORE->>CORE_ISR: Store in Core ISR Cache
            end
            CORE-->>RT: Return Page
            RT->>ISR: Store in Shield ISR Cache
            RT-->>CDN: Return Page
            CDN-->>U: Return Response (~350ms)
        end
    end
```

### Admin Panel Access

**Question**: How are admin pages protected and accessed?

```mermaid
sequenceDiagram
    participant U as User
    participant MW as Shield Middleware
    participant CDN as Shield CDN
    participant RT as Shield Runtime
    participant CORE as Core App
    participant CORE_RT as Core Runtime
    participant R as Redis

    U->>MW: GET example.com/admin
    MW->>MW: Parse hostname, check subdomain

    alt Is Subdomain
        MW-->>U: Redirect to Root Domain
    else Not Subdomain
        MW->>CDN: Check CDN Cache
        alt Cache Hit
            CDN-->>U: Return Cached Response
        else Cache Miss
            CDN->>RT: Forward Request
            RT->>CORE: Rewrite to Core App
            CORE->>CORE_RT: Generate Admin Page (Runtime)
            CORE_RT->>R: Fetch All Subdomains
            R-->>CORE_RT: Return Subdomain List
            CORE_RT-->>CORE: Return Admin Page
            CORE-->>RT: Return Admin Page
            RT-->>U: Return Response
        end
    end
```

### Blog Post Page

**Question**: How are individual blog posts served with tenant context?

```mermaid
sequenceDiagram
    participant U as User
    participant MW as Shield Middleware
    participant CDN as Shield CDN
    participant ISR as Shield ISR
    participant RT as Shield Runtime
    participant CORE as Core App
    participant CORE_ISR as Core ISR
    participant CORE_RT as Core Runtime
    participant R as Redis

    U->>MW: GET tenant.example.com/123
    MW->>MW: Extract subdomain "tenant"
    MW->>CDN: Check CDN Cache (1h TTL)

    alt Cache Hit
        CDN-->>U: Return Cached Response (~50ms)
    else Cache Miss
        CDN->>ISR: Check ISR Cache
        alt ISR Hit
            ISR-->>CDN: Return Cached Page
            CDN-->>U: Return Response (~100ms)
        else ISR Miss
            CDN->>RT: Generate Page
            RT->>CORE: Rewrite to /s/tenant/123
            CORE->>CORE_ISR: Check Core ISR Cache
            alt Core ISR Hit
                CORE_ISR-->>CORE: Return Cached Page
            else Core ISR Miss
                CORE->>CORE_RT: Generate Page (Runtime)
                CORE_RT->>R: Fetch Tenant Data
                R-->>CORE_RT: Return Tenant Data
                CORE_RT-->>CORE: Return Generated Page
                CORE->>CORE_ISR: Store in Core ISR Cache
            end
            CORE-->>RT: Return Page
            RT->>ISR: Store in Shield ISR Cache
            RT-->>CDN: Return Page
            CDN-->>U: Return Response (~350ms)
        end
    end
```

## Cache Strategy & Pre-warming

### Multi-Layer Caching Architecture

The system employs a sophisticated multi-layer caching strategy:

```mermaid
graph TB
    subgraph "Cache Layers"
        CDN[Shield CDN<br/>1 Hour TTL<br/>Protective Layer]
        ISR1[Shield ISR<br/>60s Revalidation<br/>Dynamic Content]
        ISR2[Core ISR<br/>60s Revalidation<br/>Page Generation]
    end

    subgraph "Cache Behavior"
        HIT[Cache Hit<br/>~50ms Response]
        MISS[Cache Miss<br/>~300ms Response]
    end

    CDN --> ISR1
    ISR1 --> ISR2
    ISR1 --> HIT
    ISR2 --> MISS

    classDef cache fill:#1976d2,color:#fff
    classDef behavior fill:#ff9800,color:#fff

    class CDN,ISR1,ISR2 cache
    class HIT,MISS behavior
```

### Cache Pre-warming Strategy

The Shield layer enables a safe cache pre-warming process that protects users from experiencing slow requests during the critical post-deployment period:

#### Phase 1: Deployment

1. Deploy Core app (ISR cache is purged)
2. Shield layer continues serving cached content
3. Users experience no performance degradation

#### Phase 2: Pre-warming

1. Make requests to Shield layer for all critical pages
2. Shield layer proxies to Core app (which rebuilds ISR cache)
3. Shield layer caches the responses
4. Core app ISR cache is now warmed

#### Phase 3: Normal Operation

1. Users hit Shield layer
2. Shield serves from cache (fast response)
3. Core app ISR cache is available for direct access

### Cache Headers Strategy

```typescript
// Shield layer cache headers
pageResponse.headers.set(
  "vercel-cdn-cache-control",
  "s-maxage=30, stale-while-revalidate=31556952"
);
```

- **s-maxage=30**: CDN cache for 30 seconds
- **stale-while-revalidate=31556952**: Serve stale content for 1 year while revalidating
- **Purpose**: Provides cache protection during deployments

## Multi-Tenant Routing

### Subdomain Detection

The system automatically detects and handles different tenants through sophisticated hostname parsing:

```typescript
function extractSubdomain(request: NextRequest): string | null {
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0];

  // Handle localhost development
  if (hostname.includes(".localhost")) {
    return hostname.split(".")[0];
  }

  // Handle production subdomains
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.split(":")[0];
  const isSubdomain =
    hostname !== rootDomain &&
    hostname !== `www.${rootDomain}` &&
    hostname.endsWith(`.${rootDomain}`);

  return isSubdomain ? hostname.replace(`.${rootDomain}`, "") : null;
}
```

### URL Rewriting Strategy

URLs are intelligently rewritten based on tenant context to ensure proper routing and cache efficiency:

```typescript
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const subdomain = extractSubdomain(request);

  if (subdomain) {
    // Block admin access from subdomains
    if (pathname.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Rewrite subdomain requests to core app
    const coreUrl = `${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.CORE_HOST}/s/${subdomain}${pathname}`;
    return NextResponse.rewrite(new URL(coreUrl));
  }

  // Rewrite root domain requests to core app
  const coreUrl = `${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.CORE_HOST}${pathname}`;
  return NextResponse.rewrite(new URL(coreUrl));
}
```

### Tenant Isolation

- **Subdomain-based**: Each tenant gets their own subdomain
- **URL Rewriting**: Subdomain requests rewritten to `/s/{tenant}` paths
- **Admin Protection**: Admin pages only accessible from root domain
- **Cache Isolation**: Each tenant's content is cached separately

## System Components

### Shield Layer (Port 3000)

**Purpose**: Provides cache protection and routing for the multi-tenant platform

**Components**:

- **Middleware**: Subdomain detection and URL rewriting
- **CDN Cache**: 1-hour TTL for all responses (protective layer)
- **ISR Cache**: 60-second revalidation for dynamic content
- **Runtime**: Proxy logic and cache management

**Key Features**:

- Subdomain extraction and routing
- Admin page protection
- Cache protection during deployments
- URL rewriting to Core app

### Core Layer (Port 3001)

**Purpose**: Generates pages and handles multi-tenant content

**Components**:

- **CDN Cache**: Edge caching for static assets
- **ISR Cache**: 60-second revalidation for dynamic pages
- **Runtime**: Page generation and data access
- **Data Access**: Direct access to Redis and file system

**Key Features**:

- Multi-tenant page generation
- Subdomain-specific content
- Direct data access (no external APIs)
- ISR cache management

### Data Layer

**Components**:

- **Redis**: Subdomain data storage and configuration
- **File System**: Blog posts and static content

## Performance Characteristics

Todo - test and update these numbers ‼️

### Cache Hit Rates

- **Shield CDN**: 0% hit rate (1-hour TTL)
- **Shield ISR**: 0% hit rate (60s revalidation)
- **Core ISR**: 0% hit rate (60s revalidation)

### Response Times

- **CDN Hit**: ~0ms average
- **ISR Hit**: ~0ms average
- **Cache Miss**: ~0ms average
- **Cold Start**: ~0ms (rare)

### Performance Benefits

1. **Deployment Protection**: No slow requests during deployments
2. **Cache Pre-warming**: Safe cache warming without user impact
3. **Multi-layer Caching**: Optimal cache utilization
4. **Edge Performance**: CDN-level caching for global performance

## Deployment & Maintenance

### Deployment Process

1. **Deploy Core App**: ISR cache is purged
2. **Shield Continues**: Serves cached content to users
3. **Pre-warm Cache**: Make requests to warm both caches
4. **Normal Operation**: Both caches are warm and serving

### Maintenance Complexity

- **Code Complexity**: ~200 lines of middleware + routing code
- **Deployment**: 2 apps to deploy with environment coordination
- **Debugging**: Complex request flow with subdomain logic
- **Monitoring**: Multi-layer cache monitoring required

### Key Benefits

- **Zero Downtime**: Deployments don't affect user experience
- **Cache Safety**: Pre-warming doesn't serve stale content
- **Performance**: Multi-layer caching ensures fast responses
- **Scalability**: Handles multiple tenants efficiently

## Configuration

### Environment Variables

```bash
# Multi-tenant platform configuration
NEXT_PUBLIC_PROTOCOL=https
SHIELD_HOST=shield.yourteam.vercel.app
CORE_HOST=core.yourteam.vercel.app
NEXT_PUBLIC_ROOT_DOMAIN=yourcoolsite.com
REDIS_URL=rediss://default:xxx@yyy-123.upstash.io:6379
```

### Cache Configuration

```typescript
// Shield layer cache headers
const cacheHeaders = {
  "vercel-cdn-cache-control": "s-maxage=30, stale-while-revalidate=31556952",
  "x-proxied": "1"
};
```

### Middleware Configuration

```typescript
// Middleware configuration
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
```

## Conclusion

The Shielded ISR Multi-Tenant Platform provides a robust solution for cache management in multi-tenant applications. By introducing a protective cache layer, the system enables:

1. **Safe Deployments**: No performance degradation during deployments
2. **Cache Pre-warming**: Safe cache warming without serving stale content
3. **Multi-Tenant Support**: Efficient subdomain-based tenant isolation
4. **Performance Optimization**: Multi-layer caching for optimal response times
5. **Operational Excellence**: Zero-downtime deployments and maintenance

The architecture successfully addresses the fundamental challenges of ISR cache management while providing a scalable, maintainable solution for multi-tenant applications.
