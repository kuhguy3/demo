// GitHub Pages serves this as a project site under /<repo>/, not the domain
// root, so the static export needs to know that prefix for its JS/CSS asset
// URLs and route links to resolve. Set BASE_PATH at build time for any other
// host (root-hosted, custom domain) where it should stay empty.
const basePath = process.env.BASE_PATH || '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully static export → deployable free on any static host (GitHub Pages, Cloudflare Pages, Vercel).
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
  basePath,
  assetPrefix: basePath,
};

export default nextConfig;
