import type { MetadataRoute } from 'next';
import { SITE, TOOLS } from '@/lib/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/analyze', '/tools', '/simulator', '/tracker', '/learn', '/about', '/privacy', '/responsible-gambling'];
  const toolRoutes = TOOLS.map((t) => `/tools/${t.slug}`);
  return [...routes, ...toolRoutes].map((path) => ({
    url: `${SITE.url}${path}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: path === '' || path === '/analyze' ? 1 : 0.7,
  }));
}
