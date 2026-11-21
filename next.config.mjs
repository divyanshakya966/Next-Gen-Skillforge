// In production the app is a static export served by the Cloudflare Worker,
// which also serves the Hono API on the same origin (see src/index.ts).
// `next dev` only serves the frontend, so in development we proxy /api/*
// to the Worker started with `npm run dev:worker` (wrangler dev, default port 8787).
const isDev = process.env.NODE_ENV === 'development';
const apiOrigin = (process.env.DEV_API_ORIGIN || 'http://localhost:8787').replace(/\/+$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  output: 'export',
  trailingSlash: true,
  ...(isDev && {
    // Keep `/api/...` paths as the client sends them instead of redirecting to `/api/.../`.
    skipTrailingSlashRedirect: true,
    async rewrites() {
      return [{ source: '/api/:path*', destination: `${apiOrigin}/api/:path*` }];
    },
  }),
};

export default nextConfig;
