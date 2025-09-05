import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  rewrites: async () => {
    return {
      beforeFiles: [
        {
          source: "/:path*",
          destination: "https://isr-multiple-pages.vercel.app/:path*",
          missing: [
            {
              type: "header",
              key: "Sec-Fetch-Mode",
              value: "navigate",
            },
          ],
        },
      ],
    };
  },
};

export default nextConfig;
