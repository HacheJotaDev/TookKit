import type { NextConfig } from "next";

const isApkBuild = !!process.env.NEXT_PUBLIC_API_URL;

const nextConfig: NextConfig = {
  output: isApkBuild ? "export" : "standalone",
  images: {
    unoptimized: isApkBuild,
    remotePatterns: isApkBuild ? undefined : [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  trailingSlash: isApkBuild,
};

export default nextConfig;
