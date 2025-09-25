// force build: 2
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	rewrites: async () => {
		return {
			beforeFiles: [
				{
					source: "/:path*",
					destination: `https://${process.env.CORE_HOST}/:path*`,
				},
			],

		};
	},
};

export default nextConfig;
