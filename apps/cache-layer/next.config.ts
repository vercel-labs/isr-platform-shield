// force build: 2
import type { NextConfig } from "next";
import createWithVercelToolbar from '@vercel/toolbar/plugins/next';

const withToolbar = createWithVercelToolbar();

const nextConfig: NextConfig = {
  headers: async () => {
    return [
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
          }
        ]
      },
    ]
  },
  rewrites: async () => {
    return {
      // We do beforeFiles to make sure requests for static files are proxied to the core app
      beforeFiles: [
        {
          source: "/:path*",
          destination: `${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.CORE_HOST}/:path*`,
        },
      ],

    };
  },
};

export default withToolbar(nextConfig);
