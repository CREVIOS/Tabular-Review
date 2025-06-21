import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_URL || 'http://backend:8000'}/api/:path*`,
      },
    ];
  },
  
  // Enable API routes proxying
  env: {
    BACKEND_URL: process.env.BACKEND_URL || 'http://backend:8000',
  },
};

export default nextConfig;
