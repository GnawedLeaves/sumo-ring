import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Rikishi portraits uploaded to Hygraph
    remotePatterns: [{ protocol: "https", hostname: "**.graphassets.com" }],
  },
  // Let phones on the same Wi-Fi use the dev server (http://<your-PC-IP>:3000). Without this, Next.js blocks
  // dev-only resources (hot reload, dev chunks) for non-localhost origins. Dev only; ignored in production.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*"],
  // The Basho page is the landing page.
  async redirects() {
    return [{ source: "/", destination: "/basho", permanent: false }];
  },
  async headers() {
    return [
      {
        // Always fetch a fresh service worker so updates roll out on the next visit.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
