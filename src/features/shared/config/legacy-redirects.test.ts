import { describe, expect, it } from "vitest";
import { astroRedirects, LEGACY_REDIRECTS, redirectFileMoves } from "./legacy-redirects.mjs";

// Every page of the 2013 site that visitors or search engines may still link to.
const LEGACY_PAGES = [
  "index.html",
  "news.html",
  "biography.html",
  "discography.html",
  "albums1.html",
  "albums2.html",
  "albums3.html",
  "albums4.html",
  "albums5.html",
  "eps.html",
  "minis.html",
  "compilations.html",
  "complete.htm",
  "klauswiese.html",
  "Umbra.html",
  "Penumbra.html",
  "pictures.html",
  "reviews.html",
  "memorial.html",
  "disclaimer.html",
];

const SITE_PAGES = ["/", "/news/", "/biography/", "/discography/", "/labels/umbra/", "/labels/penumbra/", "/gallery/", "/memorial/", "/about/"];
const DISCOGRAPHY_ANCHORS = ["albums", "eps", "compilations", "kw-remasters"];

describe("LEGACY_REDIRECTS", () => {
  it.each(LEGACY_PAGES)("maps /%s to a page of the new site", (file) => {
    const destination = LEGACY_REDIRECTS[`/${file}`];
    expect(destination).toBeDefined();
    const [path, anchor] = destination.split("#");
    expect(SITE_PAGES).toContain(path);
    if (anchor) {
      expect(path).toBe("/discography/");
      expect(DISCOGRAPHY_ANCHORS).toContain(anchor);
    }
  });

  it("only redirects legacy pages", () => {
    expect(Object.keys(LEGACY_REDIRECTS).sort()).toEqual(LEGACY_PAGES.map((file) => `/${file}`).sort());
  });

  it("sends the release tables to the matching discography section", () => {
    expect(LEGACY_REDIRECTS["/albums3.html"]).toBe("/discography/#albums");
    expect(LEGACY_REDIRECTS["/minis.html"]).toBe("/discography/#eps");
    expect(LEGACY_REDIRECTS["/compilations.html"]).toBe("/discography/#compilations");
    expect(LEGACY_REDIRECTS["/klauswiese.html"]).toBe("/labels/umbra/");
  });
});

describe("astroRedirects", () => {
  it("leaves out /index.html, which the home page already is", () => {
    const redirects = astroRedirects();
    expect(redirects["/index.html"]).toBeUndefined();
    expect(redirects["/news.html"]).toBe("/news/");
    expect(Object.keys(redirects)).toHaveLength(LEGACY_PAGES.length - 1);
  });
});

describe("redirectFileMoves", () => {
  it("turns Astro's `<file>/index.html` output into a file at the legacy path", () => {
    expect(redirectFileMoves(["/news.html", "/complete.htm"])).toEqual([
      { from: "news.html/index.html", to: "news.html" },
      { from: "complete.htm/index.html", to: "complete.htm" },
    ]);
  });

  it("ignores sources that are not legacy file names", () => {
    expect(redirectFileMoves(["/old-page/"])).toEqual([]);
  });
});
