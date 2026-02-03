import type { NextConfig } from "next";

const isExport = process.env.NEXT_OUTPUT === 'export';

const nextConfig: NextConfig = {
  devIndicators: false,
  ...(isExport ? { output: 'export' } : {}),
  images: {
    unoptimized: true,
  },
  ...(isExport
    ? {
        webpack: (config) => {
          config.resolve.alias['@/lib/buildQueue'] = false;
          config.resolve.alias['@/lib/buildRunner'] = false;
          return config;
        },
      }
    : {}),
};

export default nextConfig;
