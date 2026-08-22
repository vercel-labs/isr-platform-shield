import type { Redirect, Rewrite, VercelConfig } from "@vercel/config/v1";
import { deploymentEnv, matchers, routes } from "@vercel/config/v1";

// Root domain for checking if redirect needed - all apex traffic should go through www.
const rootDomain = deploymentEnv("NEXT_PUBLIC_ROOT_DOMAIN");
const shieldEnvironment = deploymentEnv("VERCEL_ENV");

// Request header needed to bypass deployment protection
const bypassHeader = {
  "x-vercel-protection-bypass": deploymentEnv("VERCEL_BYPASS_TOKEN"),
};

const pocRequestHeaders = {
  ...bypassHeader,
  "x-poc-shield-environment": shieldEnvironment,
};

// Cache settings and response header to add for relevant routes
const sMaxAge = 120;
const swr = 31556952;
const cacheHeader = {
  "CDN-Cache-Control": `s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
  "x-vercel-enable-rewrite-caching": "1",
};

const pocCacheHeader = {
  "CDN-Cache-Control": "s-maxage=30, stale-while-revalidate=31536000",
  "x-vercel-enable-rewrite-caching": "1",
};

const pocProfiles = ["free", "member", "enterprise"];

// Base url for rewrites
const core = deploymentEnv("CORE_HOST");

// Shield rewrite rules
// Some routes need to use the captured subdomain/hostname in their transform while some don't,
// so there are two types of rewrites
const rewrites = {
  withoutCapturedHost: [
    ["/api/shield/(.*)", "/api/$1"], // Shield internal API routes
    ["/_next/(.*)", `https://${core}/_next/$1`], // Next.js assets - no host condition needed
  ],
  withCapturedHost: [
    ["/", `https://${core}/s/$subdomain`], // Root for tenants
    ["/((?!_next/|api/|s/).+)", `https://${core}/s/$subdomain/$1`], // Subdomain path for tenants
  ],
  fallback: [
    ["(.*)", `https://${core}/$1`], // Fallback route for tenants
  ],
};

// Exported project config
export const config: VercelConfig = {
  framework: "nextjs",
  routes: [
    routes.redirect("/:path*", `https://www.${rootDomain}/:path*`, {
      has: [matchers.host(rootDomain)],
      permanent: true,
    }) as Redirect,
    routes.rewrite("/__poc/control/(.*)", `https://${core}/__poc/control/$1`, {
      requestHeaders: { ...pocRequestHeaders },
    }) as Rewrite,
    routes.rewrite("/__poc/page/(.*)", `https://${core}/__poc/page/$1`, {
      requestHeaders: { ...pocRequestHeaders },
      responseHeaders: { ...pocCacheHeader },
    }) as Rewrite,
    ...pocProfiles.map(
      (profile) =>
        routes.rewrite(
          "/__poc/profile/(.*)",
          `https://${core}/__poc/profile/$1`,
          {
            has: [{ type: "cookie", key: "poc-profile", value: profile }],
            requestHeaders: {
              ...pocRequestHeaders,
              "x-content-profile": profile,
            },
            responseHeaders: {
              ...pocCacheHeader,
              Vary: "x-content-profile",
            },
          },
        ) as Rewrite,
    ),
    routes.rewrite("/__poc/profile/(.*)", `https://${core}/__poc/profile/$1`, {
      requestHeaders: {
        ...pocRequestHeaders,
        "x-content-profile": "free",
      },
      responseHeaders: {
        ...pocCacheHeader,
        Vary: "x-content-profile",
      },
    }) as Rewrite,
    ...rewrites.withoutCapturedHost.map(
      ([src, dest]) =>
        routes.rewrite(src, dest, {
          requestHeaders: { ...bypassHeader },
        }) as Rewrite,
    ),
    ...rewrites.withCapturedHost.map(
      ([src, dest]) =>
        routes.rewrite(src, dest, {
          has: [
            matchers.host("(?<subdomain>.*)\\.[^\\.]+\\.[^\\.]+"), // This captured value is used in the destination URL
          ],
          requestHeaders: { ...bypassHeader },
          responseHeaders: { ...cacheHeader },
        }) as Rewrite,
    ),
    ...rewrites.fallback.map(
      ([src, dest]) =>
        routes.rewrite(src, dest, {
          requestHeaders: { ...bypassHeader },
        }) as Rewrite,
    ),
  ],
};
