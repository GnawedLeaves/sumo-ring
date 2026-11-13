import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sumo Ring",
    short_name: "Sumo Ring",
    description: "Live streams, basho results, rikishi stats and sumo news.",
    id: "/basho",
    start_url: "/basho",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f2ebe6",
    theme_color: "#160572",
    categories: ["sports", "news", "entertainment"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today's torikumi", url: "/basho" },
      { name: "Streams", url: "/streams" },
      { name: "Rikishi", url: "/rikishi" },
    ],
  };
}
