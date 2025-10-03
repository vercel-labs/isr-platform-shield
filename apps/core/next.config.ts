// force build: 2
import type { NextConfig } from 'next';
import createWithVercelToolbar from '@vercel/toolbar/plugins/next';

const withToolbar = createWithVercelToolbar();

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'www.high-performance-platform.com'
      ],
    },
  },
};

export default withToolbar(nextConfig);
