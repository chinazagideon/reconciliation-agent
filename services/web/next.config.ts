import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile the shared types package from the monorepo
  transpilePackages: ["@resolution/shared"],
};

export default nextConfig;
