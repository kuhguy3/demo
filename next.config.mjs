/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully static export → deployable free on any static host (GitHub Pages, Cloudflare Pages, Vercel).
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
};

export default nextConfig;
