# Environment Variables Configuration

This project uses environment variables for service communication instead of a centralized config package. This approach is simpler and more straightforward.

## Environment Files

Each app has its own `.env.local` file with the service hostnames:

### API App (`apps/api/.env.local`)

```bash
# API Service Environment Variables
# This service doesn't need to call other services currently
# But keeping this file for consistency and future use

# Development URLs (for local development)
CORE_HOST=localhost:3001
CACHE_LAYER_HOST=localhost:3000

# Production URLs (for production deployment)
# CORE_HOST=core.pzvtest314.vercel.app
# CACHE_LAYER_HOST=pzona.lol
```

### Core App (`apps/core/.env.local`)

```bash
# Core Service Environment Variables

# Development URLs (for local development)
API_HOST=localhost:3002
CACHE_LAYER_HOST=localhost:3000

# Production URLs (for production deployment)
# API_HOST=api.pzvtest314.vercel.app
# CACHE_LAYER_HOST=pzona.lol
```

### Cache Layer (`apps/cache-layer/.env.local`)

```bash
# Cache Layer Service Environment Variables

# Development URLs (for local development)
CORE_HOST=localhost:3001
API_HOST=localhost:3002

# Production URLs (for production deployment)
# CORE_HOST=core.pzvtest314.vercel.app
# API_HOST=api.pzvtest314.vercel.app
```

## Usage in Code

### Simple Pattern

```typescript
const getApiUrl = () => {
  const apiHost = process.env.API_HOST || "localhost:3002";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  return `${protocol}://${apiHost}`;
};
```

### Service Communication Flow

```txt
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Cache Layer   │───▶│   Core App      │───▶│   API App       │
│   (Port 3000)   │    │   (Port 3001)   │    │   (Port 3002)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
   Uses CORE_HOST          Uses API_HOST            Serves data
   from .env.local         from .env.local          from JSON
```

## Development vs Production

- **Production**: Uses Vercel deployment URLs with HTTPS protocol
- **Development**: Uses `localhost`

### Default Dev Ports

- **Cache Layer**: 3000
- **Core App**: 3001
- **API App**: 3002
