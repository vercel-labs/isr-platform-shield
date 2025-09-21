// force build: 2
import type { NextConfig } from "next";
import createWithVercelToolbar from '@vercel/toolbar/plugins/next';

const withToolbar = createWithVercelToolbar();

const nextConfig: NextConfig = {
  rewrites: async () => {
    return {
      beforeFiles: [
        {
          source: "/:path*",
          destination: `https://pzona.fun/:path*`,
        },
      ],
    };
  },
};

export default withToolbar(nextConfig);
