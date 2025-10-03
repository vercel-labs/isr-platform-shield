# Validating the shielded ISR architecture

This doc contains testing and validation steps for different components of the system.

> Note: the header of each page includes a timestamp and a deployment ID (for the deployment that *generated* the page) for debugging.

## Routing

The `validator` package includes several unit tests to ensure the correct content is served from key paths:

- `<base_url>/` - Homepage
- `<base_url>/admin` - Admin dashboard
- `<subdomain>.<base_url>/` - Subdomain homepage
- `<subdomain>.<base_url>/<n>` - Blog post

Run the tests with `pnpm run validate:routing`.

## Cache behavior

### Automated

The `validator` package includes unit tests specific to caching as well.

Run the tests with `pnpm run validate:cache`. Note that these tests rely on the `cool` and `test` subdomains to exist in the database, and may fail if one of them is deleted.

### Manual

You can also observe cache behavior by making manual requests with the `request-sub-page <subdomain>` helper detailed below.

## Tag invalidation

The repo includes helpers to perform tag invalidation at both layers. The following scripts can be run from the `bin` directory:

- `delete-tag-core <tag>` - Dangerously delete specified tag from the core project
- `invalidate-tag-shield <tag>` - Invalidate specified tag from the shield project
- `purge-tag <tag>` - Invalidate the specified tag from shield project and dangerously delete from the core project
- `request-sub-page <subdomain>` - Make a request to the specified subdomain

A quick test to observe the invalidation behavior:

1. Run `request-sub-page cool` (or for whichever subdomain you want). Look for `x-vercel-cache: HIT` and `x-vercel-cache-level: regional`. If these aren't present on the first request, repeat. Once you see these, it means you're receiving an ISR page from the `shield` CDN cache.
2. Run `invalidate-tag-shield cool` (replacing subdomain if needed).
   1. Optionally, you can run `delete-tag-core cool` to dangerously delete the tag *only* from the core app. This is also performed serially by the shield invalidation, so it's not necessary to run both.
3. Request the same subdomain page with `request-sub-page cool`. This time, look for `x-vercel-cache: STALE` and `x-vercel-cache-level: regional` in the response headers, indicating that stale content was served and a revalidation was triggered.

## Skew protection

Skew protection can be tested on the blog post pages by visiting a page (hard nav) like `https://cool.high-performance-platform.com/1`, returning to the code, deleting entries from `core/lib/data.json`, and deploying while remaining on the page.

When you return to the browser, soft nav to the broken pages will continue to function, even beyond the 120s `s-maxage` value, as requests continue to route through the "pinned" deployment.
