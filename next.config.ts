import type { NextConfig } from "next";
import os from "os";
import dns from "dns";

// Force Node.js to prefer IPv4 over IPv6 when resolving DNS to avoid NAT64/IPv6 connection timeouts to Supabase
dns.setDefaultResultOrder("ipv4first");

function getLocalSubnetOrigins() {
  const origins = ["localhost", "127.0.0.1"];
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const net of interfaces[name] || []) {
        if (net.family === "IPv4" && !net.internal) {
          const parts = net.address.split(".");
          if (parts.length === 4) {
            const prefix = parts.slice(0, 3).join(".");
            // Add all possible host IPs in the same subnet
            for (let i = 1; i <= 254; i++) {
              origins.push(`${prefix}.${i}`);
            }
          }
        }
      }
    }
  } catch (e) {
    // fallback
  }
  return origins;
}

const localOrigins = getLocalSubnetOrigins();

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: localOrigins,
  experimental: {
    serverActions: {
      allowedOrigins: localOrigins.flatMap((origin) => [origin, `${origin}:3000`]),
    },
  },
};

export default nextConfig;
