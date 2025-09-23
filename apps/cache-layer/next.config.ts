// force build: 2
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  rewrites: async () => {
    return {
      // beforeFiles: [
      //   {
      //     source: "/:path*",
      //     destination: `${process.env.NEXT_PUBLIC_PROTOCOL}://${process.env.CORE_HOST}/:path*`,
      //   },
      // ],
    };
  },
  // Leaving this as a comment so I can use it locally
  // headers: async () => [
  //   {
  //     "source": "/:path*",
  //     "headers": [
  //       {
  //         "key": "x-vercel-enable-rewrite-caching",
  //         "value": "1"
  //       },
  //       {
  //         "key": "vercel-cdn-cache-control",
  //         "value": "s-maxage=30, stale-while-revalidate=31556952"
  //       }
  //     ]
  //   }
  // ]
};

export default nextConfig;
