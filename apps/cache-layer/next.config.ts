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
};

export default nextConfig;
