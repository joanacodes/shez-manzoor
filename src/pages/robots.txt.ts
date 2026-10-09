import type { APIRoute } from 'astro';
import { INDEXABLE } from 'astro:env/server';

export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  const sitemap = new URL(`${base}sitemap-index.xml`, site).toString();
  const body = INDEXABLE
    ? `# Shez Manzoor (SHEZ)\n# Search engines and AI assistants are welcome.\nUser-agent: *\nAllow: /\n\nSitemap: ${sitemap}\n`
    : `# Preview build: hidden from search engines until launch.\nUser-agent: *\nDisallow: /\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
