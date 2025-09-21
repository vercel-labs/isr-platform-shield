// force build: 2
import type { NextConfig } from "next";
import createWithVercelToolbar from '@vercel/toolbar/plugins/next';

const withToolbar = createWithVercelToolbar();

const nextConfig: NextConfig = {
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
