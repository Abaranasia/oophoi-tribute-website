// @ts-check
import { rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

import { astroRedirects, redirectFileMoves } from './src/features/shared/config/legacy-redirects.mjs';

// The production domain is not decided yet; override it with SITE_URL at build time.
const site = process.env.SITE_URL ?? 'https://oophoi.example.org';

// Old pages of the 2013 site (e.g. `/news.html`); the static build emits a redirect page for each.
const redirects = astroRedirects();

/** Moves each redirect page from `news.html/index.html` to `news.html`, where static hosts serve it. */
const legacyRedirectFiles = {
  name: 'legacy-redirect-files',
  hooks: {
    /** @param {{ dir: URL }} options */
    'astro:build:done': async ({ dir }) => {
      const out = fileURLToPath(dir);
      for (const { from, to } of redirectFileMoves(Object.keys(redirects))) {
        const parked = `${out}/${to}.tmp`;
        await rename(`${out}/${from}`, parked);
        await rm(`${out}/${to}`, { recursive: true });
        await rename(parked, `${out}/${to}`);
      }
    },
  },
};

// https://astro.build/config
export default defineConfig({
  site,
  // Pages build to `<path>/index.html`, which static hosts serve at `<path>/`.
  // Canonical URLs, the sitemap and internal links all use the trailing slash.
  trailingSlash: 'always',
  redirects,
  integrations: [
    mdx(),
    sitemap({
      // Leaves out the 404 page and the legacy redirect pages.
      filter: (page) => !/\/404\/?$|\.html?\/?$/.test(new URL(page).pathname),
    }),
    legacyRedirectFiles,
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
