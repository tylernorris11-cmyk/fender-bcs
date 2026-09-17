// Static, same on every response — the Content-Security-Policy is dynamic
// (needs a per-request nonce) so it's set in middleware.ts instead.
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Nothing in the app calls the camera/mic/location APIs — photos go
  // through a plain file input with capture="environment" instead — so
  // these are safe to switch off outright rather than merely unused.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 16mb to leave headroom for a photographed mill certificate upload.
  experimental: { serverActions: { bodySizeLimit: '16mb' } },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};
export default nextConfig;
