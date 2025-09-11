# Core App

The main Next.js application that serves blog posts with subdomain support.

## What it does

- Displays blog posts from the API service
- Supports custom subdomains for different tenants
- Shows individual blog post pages
- Provides subdomain-specific landing pages with random posts

## Pages

- `/` - Main landing page
- `/s/[subdomain]` - Subdomain-specific page with random posts
- `/s/[subdomain]/[id]` - Individual blog post page

## Development

```bash
npm run dev
```

The core app runs on port 3000 by default.