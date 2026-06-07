// force build: 2
import type { NextConfig } from 'next';
import createWithVercelToolbar from '@vercel/toolbar/plugins/next';
import { config } from '@platform/config';

const withToolbar = createWithVercelToolbar();

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [config.rootDomain, `www.${config.rootDomain}`],
    },
  },
};

export default withToolbar(nextConfig);
