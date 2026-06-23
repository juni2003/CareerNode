import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow building with the assistant page using react-markdown (ESM)
  experimental: {},
  // Transpile recharts for compatibility
  transpilePackages: [],
};

export default nextConfig;
