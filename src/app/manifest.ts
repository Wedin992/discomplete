import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Discomplete",
    short_name: "Discomplete",
    description: "A music diary. Log what you listen to, remember how it felt, find what to play next.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#131314",
    theme_color: "#131314",
    categories: ["music", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Log a listen", short_name: "Log", url: "/log", icons: [{ src: "/icon-192.png", sizes: "192x192" }] }],
  };
}
