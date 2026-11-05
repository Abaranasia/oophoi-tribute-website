// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// The production domain is not decided yet; override it with SITE_URL at build time.
const site = process.env.SITE_URL ?? 'https://oophoi.example.org';

// https://astro.build/config
export default defineConfig({
  site,
  // Pages build to `<path>/index.html`, which static hosts serve at `<path>/`.
  // Canonical URLs, the sitemap and internal links all use the trailing slash.
  trailingSlash: 'always',
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !/\/404\/?$/.test(new URL(page).pathname),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
