# Oöphoi tribute website

An unofficial, non-commercial tribute to the Italian ambient musician Oöphoi (Gianluigi Gasparetti, 1958–2013).

## Stack

Astro 7 (static), Tailwind CSS 4 via `@tailwindcss/vite`, MDX, sitemap, TypeScript (strict), Vitest, pnpm.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the dev server |
| `pnpm test` | Run the unit tests (Vitest) |
| `pnpm build` | `astro check`, then a static build to `dist/` |
| `pnpm preview` | Serve the built site |

Set `SITE_URL` at build time to use the production domain in canonical URLs, the sitemap and `robots.txt`. Until it is set, they use a placeholder domain.

## Layout

- `src/features/discography/`: release components and domain helpers (grouping, selection by label or type, credits, Discogs URLs, release links).
- `src/features/gallery/`: photo grouping and the gallery grid with its `<dialog>` lightbox.
- `src/features/labels/`: release sections for the Umbra and Penumbra pages.
- `src/features/news/`: access to the news posts.
- `src/features/home/`: home page sections.
- `src/features/shared/`: layout, header, footer, prose page components, SEO, site config and the legacy redirect map.
- `src/content/releases/`: one JSON file per release. **This is the source of truth: edit these files by hand.** Schemas are in `src/content.config.ts`.
- `src/content/news/`: one Markdown file per news post.
- `src/content/photos/`: one JSON file per gallery photo (image, alt text, caption, people, group).
- `docs/copy-changes.md`: every rewrite of legacy text, for owner review.

## Legacy redirects

`src/features/shared/config/legacy-redirects.mjs` maps every page of the 2013 site (`news.html`, `albums1.html`, …) to its new URL. Astro `redirects` emit a redirect page for each, and a small build hook in `astro.config.mjs` moves it to the legacy file path (`dist/news.html`), where a static host serves it. `/index.html` needs no redirect: it is the home page.
- `scripts/`: the one-time legacy migration, kept for provenance. The pure parsers in `scripts/lib/` are unit tested.

## Legacy migration (one-time, already done)

The release data was imported once from the 2013 site with `scripts/migrate-legacy.mjs`. It read the legacy pages as iso-8859-1, skipped duplicate and leftover pages, and recovered Discogs ids from corrupted links.

The script now refuses to run while `src/content/releases/` holds any release file, so hand edits can't be overwritten by accident. It writes everything into staging directories first and only swaps them in when every row parsed and every file was written; otherwise nothing changes. Only for a deliberate full re-import, which **discards every hand edit** to the releases and covers:

```sh
node scripts/migrate-legacy.mjs "G:/Webs/oophoi" --force   # or set LEGACY_DIR
```
