import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**',
      }
    ],
    unoptimized: true
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    // Add rule for PDF.js worker
    config.module.rules.push({
      test: /pdf\.worker\.(mjs|js)$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/chunks/[name].[hash][ext]',
      },
    });
    return config;
  },
};

export default nextConfig;
