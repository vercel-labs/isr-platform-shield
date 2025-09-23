// force build: 0
import type { NextConfig } from "next";
import createWithVercelToolbar from '@vercel/toolbar/plugins/next';

const withToolbar = createWithVercelToolbar();

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/:path*",
      has: [
        {
          type: "header",
          key: "sec-fetch-mode",
          value: "navigate"
        }
      ],
      headers: [
        {
          key: "vary",
          value: "x-forwarded-host"
        }
      ]
    }
  ]
};

export default withToolbar(nextConfig);
