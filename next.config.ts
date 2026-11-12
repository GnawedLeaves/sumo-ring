import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Rikishi portraits uploaded to Hygraph
    remotePatterns: [{ protocol: "https", hostname: "**.graphassets.com" }],
  },
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
