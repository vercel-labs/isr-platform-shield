# Validating the shielded ISR architecture

This doc contains testing and validation steps for different components of the system.

## Configuration

Tests and `bin/` helpers read `config/validation.json`. Copy `config/validation.example.json` to `config/validation.json` and edit your values. TypeScript code loads the same file via `@platform/config`.

See [config/README.md](/config/README.md) for field descriptions.

> Note: the header of each page includes a timestamp and a deployment ID (for the deployment that *generated* the page) for debugging.

## Routing

The `validator` package includes several integration tests to ensure the correct content is served from key paths (via `shieldUrl` and `rootDomain` in config):

- `www.<rootDomain>/` — homepage
- `www.<rootDomain>/admin` — admin dashboard
- `<subdomains.primary>.<rootDomain>/` — primary subdomain homepage
- `<subdomains.primary>.<rootDomain>/<n>` — blog post

Run the tests with `pnpm run validate:routing`.

## Cache behavior

### Automated

The `validator` package includes integration tests specific to caching as well.

Run the tests with `pnpm run validate:cache`. These tests require the primary and secondary validation subdomains (`subdomains.primary` and `subdomains.secondary` in config) to exist in Redis. If they are missing, run `pnpm seed` — see [seeding](/docs/SEEDING.md).

### Manual

You can also observe cache behavior by making manual requests with the `request-sub-page <subdomain>` helper detailed below.

## Tag invalidation

The repo includes helpers to perform tag invalidation at both layers. After `pnpm setup`, these are available on your PATH:

- `delete-tag-core <tag>` — delete specified tag from the Core project
- `invalidate-tag-shield <tag>` — invalidate specified tag on the Shield project
- `purge-tag <tag>` — invalidate on Shield and delete on Core
- `request-sub-page <subdomain>` — request `https://<subdomain>.<rootDomain>/` and print response headers
- `seed-subdomains` — populate example tenants in Redis (also available as `pnpm seed`)

A quick test to observe the invalidation behavior (using the primary subdomain from config):

1. Run `request-sub-page <subdomains.primary>`. Look for `x-vercel-cache: HIT` and `x-vercel-cache-level: regional`. If these aren't present on the first request, repeat. Once you see these, you're receiving a cached page from the Shield CDN.
2. Run `invalidate-tag-shield <subdomains.primary>`.
   1. Optionally, you can run `delete-tag-core <subdomains.primary>` to delete the tag *only* from Core. Shield invalidation performs Core deletion first internally, so running both is not necessary.
3. Request the same subdomain page again. Look for `x-vercel-cache: STALE` and `x-vercel-cache-level: regional`, indicating stale content was served and revalidation was triggered.

## Skew protection

Skew protection can be tested on blog post pages by visiting the primary post URL (hard nav) — `https://<subdomains.primary>.<rootDomain>/1` from config — then deleting entries from `apps/core/lib/data.json` and deploying Core while remaining on the page.

When you return to the browser, soft nav to the broken pages will continue to function, even beyond the 120s Shield `s-maxage` value, as requests continue to route through the pinned deployment.
