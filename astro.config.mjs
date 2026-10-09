// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * Where the site is deployed decides its absolute URL and base path.
 * - Production (his domain): nothing to set, the defaults below apply.
 * - GitHub Pages: the workflow passes SITE_URL and BASE_PATH.
 * - Netlify and Vercel: their own variables are picked up automatically.
 */
const env = process.env;
const vercelUrl = env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined;
const SITE_URL =
  env.SITE_URL || env.DEPLOY_PRIME_URL || env.URL || vercelUrl || 'https://www.shezmanzoormusic.co.uk';
const BASE_PATH = env.BASE_PATH || '/';
/** Astro does not prefix redirect targets with the base path, so do it here. */
const to = (/** @type {string} */ path) => `${BASE_PATH.replace(/\/$/, '')}${path}`;

const fontFile = (/** @type {string} */ pkg, /** @type {string} */ file) => `./node_modules/${pkg}/files/${file}`;

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH,
  trailingSlash: 'always',
  // Small stylesheets: inlining them saves render-blocking requests on every page
  build: { format: 'directory', inlineStylesheets: 'always' },
  compressHTML: true,
  prefetch: { prefetchAll: false, defaultStrategy: 'hover' },
  redirects: {
    // Old Squarespace URLs that already rank
    '/epk/releases': to('/music/'),
    '/releases': to('/music/'),
    '/bio': to('/about/'),
  },
  image: {
    responsiveStyles: false,
  },
  env: {
    schema: {
      /** Search engines only index the site when INDEXABLE=true. Set it for the launch build only. */
      INDEXABLE: envField.boolean({ context: 'server', access: 'public', default: false }),
    },
  },
  integrations: [
    sitemap({
      filter: (page) => !/\/(404|epk\/releases|releases|bio)\/?$/.test(page),
    }),
  ],
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Instrument Serif',
      cssVariable: '--font-serif',
      fallbacks: ['Georgia', 'serif'],
      options: {
        variants: [
          {
            src: [fontFile('@fontsource/instrument-serif', 'instrument-serif-latin-400-normal.woff2')],
            weight: '400',
            style: 'normal',
          },
          {
            src: [fontFile('@fontsource/instrument-serif', 'instrument-serif-latin-400-italic.woff2')],
            weight: '400',
            style: 'italic',
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Instrument Sans',
      cssVariable: '--font-sans',
      fallbacks: ['Arial', 'sans-serif'],
      options: {
        variants: [
          {
            src: [fontFile('@fontsource-variable/instrument-sans', 'instrument-sans-latin-wght-normal.woff2')],
            weight: '400 700',
            style: 'normal',
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'DM Mono',
      cssVariable: '--font-mono',
      fallbacks: ['ui-monospace', 'monospace'],
      options: {
        variants: [
          {
            src: [fontFile('@fontsource/dm-mono', 'dm-mono-latin-400-normal.woff2')],
            weight: '400',
            style: 'normal',
          },
        ],
      },
    },
  ],
});
