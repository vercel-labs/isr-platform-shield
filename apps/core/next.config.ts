// force build: 0
import type { NextConfig } from "next";
import createWithVercelToolbar from "@vercel/toolbar/plugins/next";

const withToolbar = createWithVercelToolbar();

const nextConfig: NextConfig = {

};

export default withToolbar(nextConfig);
