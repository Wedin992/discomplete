import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn-images.dzcdn.net" },
      { protocol: "https", hostname: "e-cdns-images.dzcdn.net" },
    ],
  },
  experimental: {
    // Keep recently visited pages in the browser for a short while, so switching
    // tabs is instant. Saving, editing or deleting clears this cache (revalidatePath).
    staleTimes: { dynamic: 60, static: 300 },
  },
};

export default nextConfig;
