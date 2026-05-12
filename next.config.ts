import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // Tree-shake named exports from heavy barrel-file libraries
  experimental: {
    optimizePackageImports: [
      'framer-motion',
      'date-fns',
      'recharts',
    ],
  },

};

export default nextConfig;
