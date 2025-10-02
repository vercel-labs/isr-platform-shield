# Validating the shielded ISR architecture

This doc contains testing and validation steps for different components of the system.

## Routing

The `validator` package includes several unit tests to ensure the correct content is served from key paths:

- `<base_url>/` - Homepage
- `<base_url>/admin` - Admin dashboard
- `<subdomain>.<base_url>/` - Subdomain homepage
- `<subdomain>.<base_url>/<n>` - Blog post

Run the tests with `pnpm run validate:routing`

## Cache behavior (wip)

The `validator` package includes unit tests specific to caching as well.

Run the tests with `pnpm run validate:cache`

## Tag invalidation

The repo includes helpers to perform tag invalidation at both layers. The following scripts can be run from the `bin` directory:

- `delete-tag-core <tag>` - Dangerously delete specified tag from the core project
- `invalidate-tag-shield <tag>` - Invalidate specified tag from the shield project
- `purge-tag <tag>` - Invalidate the specified tag from shield project and dangerously delete from the core project
- `request-sub-page <subdomain>` - Make a request to the specified subdomain

## Skew protection

wip