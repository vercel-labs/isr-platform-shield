// force build: 2
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	rewrites: async () => {
		return {
			beforeFiles: [
				{
					source: "/:path*",
					destination: `${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.CORE_HOST}/:path*`,
					has: [
						{
							type: "header",
							key: "x-rewrite-to-core",
							value: "1",
						},
					]
				},
			],
			afterFiles: [
				{
					source: "/:path*",
					destination: `${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.CACHE_LAYER_HOST}/:path*`,
				},
			],
		};
	},
};

export default nextConfig;
