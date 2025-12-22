import { routes, deploymentEnv } from "@vercel/config/v1";
import type { VercelConfig } from "@vercel/config/v1";

// Could read these remotely, using env vars for simplicity
const core = deploymentEnv("CORE_HOST");

// Cache settings
const sMaxAge = 120;
const swr = 31556952;

// Shield rewrite rules
const shieldRewrites = [
	["/", `https://${core}/s/$host`], // Root for tenants
	["/((?!_next|api).*)", `https://${core}/s/$host/$1`], // Subdomain path for tenants
	["(.*)", `https://${core}/$1`], // Fallback route for tenants
];

export const config: VercelConfig = {
	framework: "nextjs",
	rewrites: [routes.rewrite("/api/shield/(.*)", "/api/$1")],
	routes: shieldRewrites.map(([src, dest]) =>
		routes.rewrite(src, dest, {
			has: [
				{
					type: "host",
					value: "(?<host>.*)\\.[^\\.]+\\.[^\\.]+", // This capture group should be used in the destination URL
				},
			],
			responseHeaders: {
				"CDN-Cache-Control": `s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
			},
		}),
	),
};
