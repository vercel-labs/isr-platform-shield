// force build: 2
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  rewrites: async () => {
    return [
      {
        source: "/:path*",
        destination: `${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.CORE_HOST}/:path*`,
      },
    ]
  },
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "x-vercel-enable-rewrite-caching",
          value: "1"
        },
        {
          key: "vercel-cdn-cache-control",
          value: "s-maxage=30, stale-while-revalidate=31556952"
        },
        {
          key: "x-vercel-bypass-protection",
          value: process.env.VERCEL_AUTOMATION_BYPASS_SECRET!
        }
      ]
    },
  ]
};

export default nextConfig;
