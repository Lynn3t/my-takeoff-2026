import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 生产环境移除 console.log
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // 实验性优化
  experimental: {
    // 优化包导入
    optimizePackageImports: ['@vercel/postgres'],
  },
  // 压缩优化
  compress: true,
  // 生产环境 source map 优化
  productionBrowserSourceMaps: false,
  // 优化图片
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
