import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Docker builds
  output: "standalone",
};

export default nextConfig;
