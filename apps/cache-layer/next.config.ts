import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  rewrites: async () => {
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";

    return {
      // We do beforeFiles to make sure requests for static files are proxied to the core app
      beforeFiles: [
        {
          source: "/:path*",
          destination: `${protocol}://${process.env.CORE_HOST}/:path*`,
          missing: [
            {
              type: "header",
              key: "Sec-Fetch-Mode",
              value: "navigate",
            },
          ],
        },
      ],
      afterFiles: [
        // Don't proxy static assets - let them be handled by middleware
        {
          source: "/_next/static/:path*",
          destination: "/_next/static/:path*",
        },
        {
          source: "/_next/image/:path*",
          destination: "/_next/image/:path*",
        },
      ],
    };
  },
};

export default nextConfig;
