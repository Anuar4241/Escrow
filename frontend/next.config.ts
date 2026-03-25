import type { NextConfig } from "next";

// NEXT_BUILD_OUTPUT=export for Capacitor/Android static build
// Default: standalone for Docker deployment
const isStaticExport = process.env.NEXT_BUILD_OUTPUT === "export";

const nextConfig: NextConfig = {
  output: isStaticExport ? "export" : "standalone",
  trailingSlash: isStaticExport,
  images: { unoptimized: isStaticExport },
};

export default nextConfig;
