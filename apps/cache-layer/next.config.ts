import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove rewrites - let middleware handle all routing logic
  // This prevents conflicts between config rewrites and middleware
};

export default nextConfig;
