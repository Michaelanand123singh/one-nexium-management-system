import type { NextConfig } from "next";
import path from "path";

// Use process.cwd() so file tracing is limited to project root (avoids scanning
// parent folders on Windows when repo has multiple lockfiles, and prevents build hang).
const projectRoot = path.resolve(process.cwd());

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: projectRoot,
  serverExternalPackages: ["ssh2"],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/planning",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      {
        source: "/documents",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
