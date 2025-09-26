# Request Flow Diagrams


This document shows the request flow for different routes through the durable ISR multi-tenant platform, including cache layers and system boundaries.

## Root Domain (/) - Landing Page

```mermaid
sequenceDiagram
    participant U as User
    participant VCL_MW as Shield Middleware
    participant VCL as Shield CDN
    participant VCL_ISR as Shield ISR
    participant VCL_RT as Shield Runtime
    participant VCA as Core CDN
    participant VCA_ISR as Core App ISR
    participant VCA_RT as Core App Runtime

    U->>VCL_MW: GET example.com/
    VCL_MW->>VCL_MW: Parse hostname, no subdomain
    VCL_MW->>VCL: Rewrite to root path
    VCL->>VCL: Check CDN Cache (1h TTL)
    alt Cache Hit
        VCL-->>U: Return Cached Response
    else Cache Miss
        VCL->>VCL_ISR: Check ISR Cache
        alt ISR Hit
            VCL_ISR-->>VCL: Return Cached Page
        else ISR Miss
            VCL->>VCL_RT: Generate Page
            VCL_RT->>VCA: Rewrite to Core App
            VCA->>VCA_ISR: Check ISR Cache (60s)
            alt ISR Hit
                VCA_ISR-->>VCA: Return Cached Page
            else ISR Miss
                VCA->>VCA_RT: Generate Page (Runtime)
                VCA_RT->>VCA_ISR: Store in ISR Cache
            end
            VCA-->>VCL_RT: Return Page
            VCL_RT->>VCL_ISR: Store in ISR Cache
        end
        VCL-->>U: Return Response
    end
```

## Subdomain (/) - Tenant Landing Page

```mermaid
sequenceDiagram
    participant U as User
    participant VCL_MW as Shield Middleware
    participant VCL as Shield CDN
    participant VCL_ISR as Shield ISR
    participant VCL_RT as Shield Runtime
    participant VCA as Core CDN
    participant VCA_ISR as Core App ISR
    participant VCA_RT as Core App Runtime
    participant R as Redis
    participant VAPI as API CDN
    participant VAPI_RT as API App Runtime

    U->>VCL_MW: GET tenant.example.com/
    VCL_MW->>VCL_MW: Parse hostname, extract subdomain
    VCL_MW->>VCL: Rewrite to /s/tenant
    VCL->>VCL: Check CDN Cache (1h TTL)
    alt Cache Hit
        VCL-->>U: Return Cached Response
    else Cache Miss
        VCL->>VCL_ISR: Check ISR Cache
        alt ISR Hit
            VCL_ISR-->>VCL: Return Cached Page
        else ISR Miss
            VCL->>VCL_RT: Generate Page
            VCL_RT->>VCA: Rewrite to Core App
            VCA->>VCA_ISR: Check ISR Cache (60s)
            alt ISR Hit
                VCA_ISR-->>VCA: Return Cached Page
            else ISR Miss
                VCA->>VCA_RT: Generate Page (Runtime)
                VCA_RT->>R: Fetch Subdomain Data
                R-->>VCA_RT: Return Subdomain Data
                VCA_RT->>VAPI: Fetch Posts
                VAPI->>VAPI_RT: Generate API Response
                VAPI_RT-->>VAPI: Return Posts Data
                VAPI-->>VCA_RT: Return Posts Data
                VCA_RT->>VCA_ISR: Store in ISR Cache
            end
            VCA-->>VCL_RT: Return Page
            VCL_RT->>VCL_ISR: Store in ISR Cache
        end
        VCL-->>U: Return Response
    end
```

## Admin Panel (/admin)

```mermaid
sequenceDiagram
    participant U as User
    participant VCL_MW as Shield Middleware
    participant VCL as Shield CDN
    participant VCL_RT as Shield Runtime
    participant VCA as Core CDN
    participant VCA_RT as Core App Runtime
    participant R as Redis

    U->>VCL_MW: GET example.com/admin
    VCL_MW->>VCL_MW: Parse hostname, check subdomain
    alt Is Subdomain
        VCL_MW-->>U: Redirect to Root Domain
    else Not Subdomain
        VCL_MW->>VCL: Rewrite to /admin
        VCL->>VCL_RT: Forward Request
        VCL_RT->>VCA: Rewrite to Core App
        VCA->>VCA_RT: Generate Admin Page (Runtime)
        VCA_RT->>R: Fetch All Subdomains
        R-->>VCA_RT: Return Subdomain List
        VCA_RT-->>VCA: Return Admin Page
        VCA-->>VCL_RT: Return Admin Page
        VCL_RT-->>U: Return Response
    end
```

## Blog Post Page (/[slug])

```mermaid
sequenceDiagram
    participant U as User
    participant VCL_MW as Shield Middleware
    participant VCL as Shield CDN
    participant VCL_ISR as Shield ISR
    participant VCL_RT as Shield Runtime
    participant VCA as Core CDN
    participant VCA_ISR as Core App ISR
    participant VCA_RT as Core App Runtime
    participant R as Redis
    participant VAPI as API CDN
    participant VAPI_RT as API App Runtime

    U->>VCL_MW: GET tenant.example.com/123
    VCL_MW->>VCL_MW: Parse hostname, extract subdomain
    VCL_MW->>VCL: Rewrite to /s/tenant/123
    VCL->>VCL: Check CDN Cache (1h TTL)
    alt Cache Hit
        VCL-->>U: Return Cached Response
    else Cache Miss
        VCL->>VCL_ISR: Check ISR Cache
        alt ISR Hit
            VCL_ISR-->>VCL: Return Cached Page
        else ISR Miss
            VCL->>VCL_RT: Generate Page
            VCL_RT->>VCA: Rewrite to Core App
            VCA->>VCA_ISR: Check ISR Cache (60s)
            alt ISR Hit
                VCA_ISR-->>VCA: Return Cached Page
            else ISR Miss
                VCA->>VCA_RT: Generate Page (Runtime)
                VCA_RT->>R: Fetch Subdomain Data
                R-->>VCA_RT: Return Subdomain Data
                VCA_RT->>VAPI: Fetch Blog Post
                VAPI->>VAPI_RT: Generate API Response
                VAPI_RT-->>VAPI: Return Data
                VAPI-->>VCA_RT: Return Data
                VCA_RT->>VCA_ISR: Store in ISR Cache
            end
            VCA-->>VCL_RT: Return Page
            VCL_RT->>VCL_ISR: Store in ISR Cache
        end
        VCL-->>U: Return Response
    end
```

## System Boundaries

Each subsystem indicated here is an independent Next.js project.

### Shield (Port 3000)

- **Vercel CDN**: 1-hour cache for all responses
- **ISR Cache**: 60-second revalidation for dynamic pages
- **Runtime**: Middleware for subdomain detection and routing, proxy to Core App
- **Middleware**: Subdomain extraction, URL rewriting, admin page protection

### Core (Port 3001)

- **Vercel CDN**: Edge caching for static assets
- **ISR Cache**: 60-second revalidation for dynamic pages
- **Runtime**: Page generation, Redis integration, API client
- **External Dependencies**: Redis for subdomain data storage
- **No Middleware**: Pure content generation server

### API App (Port 3002)

- **Runtime**: Simplified API endpoints for posts
- **Endpoints**: `/posts` (get 5 posts) and `/posts/[id]` (get single post)
- **Data Source**: JSON file with in-memory caching
- **Purpose**: Content API for the multi-tenant platform

