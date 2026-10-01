import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost:3000", "127.0.0.1:3000", "localhost", "127.0.0.1"],
  experimental: {
    serverActions: {
      // In production (Vercel), allow the deployed domain.
      // In dev, allow all origins (handled dynamically below via env).
      allowedOrigins: isProd
        ? [
            process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, "") ?? "",
            // Add your Vercel preview domains pattern if needed
          ].filter(Boolean)
        : ["*"],
    },
  },
};

export default nextConfig;
