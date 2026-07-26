import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@parallel/contracts",
    "@parallel/statics-patterns",
    "@parallel/twin-engine",
  ],
};

export default nextConfig;
