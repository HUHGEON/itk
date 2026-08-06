import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ws pulls in optional native addons the bundler shouldn't try to resolve.
  serverExternalPackages: ["ws"],
  // Two lockfiles exist above this directory; pin the root so Turbopack stops guessing.
  turbopack: { root: __dirname },
};

export default nextConfig;
