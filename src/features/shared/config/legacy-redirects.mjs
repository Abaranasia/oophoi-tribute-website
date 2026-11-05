// Pages of the 2013 site and where they live now. Used as Astro `redirects` in astro.config.mjs,
// so the static build emits a redirect page for each old URL.

const DISCOGRAPHY = "/discography/";

/** @type {Readonly<Record<string, string>>} */
export const LEGACY_REDIRECTS = {
  "/index.html": "/",
  "/news.html": "/news/",
  "/biography.html": "/biography/",
  "/discography.html": DISCOGRAPHY,
  "/complete.htm": DISCOGRAPHY,
  "/albums1.html": `${DISCOGRAPHY}#albums`,
  "/albums2.html": `${DISCOGRAPHY}#albums`,
  "/albums3.html": `${DISCOGRAPHY}#albums`,
  "/albums4.html": `${DISCOGRAPHY}#albums`,
  "/albums5.html": `${DISCOGRAPHY}#albums`,
  "/eps.html": `${DISCOGRAPHY}#eps`,
  "/minis.html": `${DISCOGRAPHY}#eps`,
  "/compilations.html": `${DISCOGRAPHY}#compilations`,
  "/klauswiese.html": "/labels/umbra/",
  "/Umbra.html": "/labels/umbra/",
  "/Penumbra.html": "/labels/penumbra/",
  "/pictures.html": "/gallery/",
  // The legacy reviews page was empty.
  "/reviews.html": "/",
  "/memorial.html": "/memorial/",
  "/disclaimer.html": "/about/",
};

/**
 * The redirects handed to Astro. `/index.html` is left out: on a static host it is the home page
 * itself, and a redirect page there would overwrite it.
 * @returns {Record<string, string>}
 */
export function astroRedirects() {
  return Object.fromEntries(Object.entries(LEGACY_REDIRECTS).filter(([source]) => source !== "/index.html"));
}

/** @typedef {{ from: string, to: string }} FileMove `from` and `to` are relative to the build output directory. */

/**
 * Astro writes the redirect page for `/news.html` to `news.html/index.html`, which a static host
 * would never serve at `/news.html`. These moves put each page at the legacy file path instead.
 * @param {readonly string[]} sources
 * @returns {FileMove[]}
 */
export function redirectFileMoves(sources) {
  return sources
    .filter((source) => /\.html?$/.test(source))
    .map((source) => {
      const file = source.replace(/^\//, "");
      return { from: `${file}/index.html`, to: file };
    });
}
