import type { NextConfig } from "next";

// RAILWAY_API_URL es server-side (sin NEXT_PUBLIC_) — solo lo lee Next.js
// en el proceso de servidor para configurar el rewrite. El browser nunca
// lo ve, por eso no hay problema de CORS.
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
  async headers() {
    return [
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
      {
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
