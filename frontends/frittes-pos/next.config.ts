import type { NextConfig } from "next";

const BACKEND = process.env.RAILWAY_API_URL ?? "http://localhost:8000/api/v1";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/proxy/:path*",
        destination: `${BACKEND}/:path*`,
      },
    ];
  },
};

export default nextConfig;
