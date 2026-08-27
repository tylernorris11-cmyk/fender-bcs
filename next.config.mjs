/** @type {import('next').NextConfig} */
const nextConfig = {
  // 16mb to leave headroom for a photographed mill certificate upload.
  experimental: { serverActions: { bodySizeLimit: '16mb' } },
};
export default nextConfig;
