import { routes, deploymentEnv } from "@vercel/config/v1";
import type { VercelConfig } from "@vercel/config/v1";

// Could read these remotely, using env vars for simplicity
const core = deploymentEnv("CORE_HOST");

// Cache settings
const sMaxAge = 120;
const swr = 31556952;

// Shield rewrite rules
const shieldRewrites = [
  ["/api/shield/(.*)", "/api/$1"], // Shield internal API routes
  ["/_next/(.*)", `https://${core}/_next/$1`], // Next.js assets - no host condition needed
  ["/", `https://${core}/s/$host`], // Root for tenants
  ["/((?!_next/|api/|s/).+)", `https://${core}/s/$host/$1`], // Subdomain path for tenants
  ["(.*)", `https://${core}/$1`], // Fallback route for tenants
];

export const config: VercelConfig = {
  framework: "nextjs",
  routes: shieldRewrites.map(([src, dest], idx) =>
    routes.rewrite(
      src,
      dest,
      // Rules 0 and 1 (api/shield and _next) don't need host condition
      idx <= 1
        ? { responseHeaders: { "x-noop": "0" } }
        : {
            has: [
              {
                type: "host",
                value: "(?<host>.*)\\.[^\\.]+\\.[^\\.]+", // This capture group should be used in the destination URL
              },
            ],
            responseHeaders: {
              "CDN-Cache-Control": `s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
            },
          },
    ),
  ),
};
