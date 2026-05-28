import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "192.168.0.107",
    "*.loca.lt",
    "*.lhr.life",
    "*.pinggy.link",
    "*.a.pinggy.link",
    "*.pinggy-free.link",
    "*.pinggy.io",
    "*.serveo.net",
    "*.serveousercontent.com",
    "*.trycloudflare.com",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
