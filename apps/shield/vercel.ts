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
	["/", `https://${core}/s/$host`], // Root for tenants
	["/((?!_next|api).*)", `https://${core}/s/$host/$1`], // Subdomain path for tenants
	["(.*)", `https://${core}/$1`], // Fallback route for tenants
];

export const config: VercelConfig = {
	framework: "nextjs",
	routes: shieldRewrites.map(([src, dest], idx) =>
		routes.rewrite(
			src,
			dest,
			// Don't add headers to the internal API routes
			idx !== 0 && {
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
