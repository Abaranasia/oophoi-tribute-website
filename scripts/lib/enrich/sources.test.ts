import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { coverUrlForArt, parseAlbumLinks, parseAlbumPage } from "./bandcamp.mjs";
import { originalImageUrl, parseProductPage, parseSearchResults } from "./databloem.mjs";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("Bandcamp", () => {
  it("lists each album slug of the /music page once, in page order", () => {
    expect(parseAlbumLinks(fixture("bandcamp-music.html"))).toEqual(["penumbra-recollected-1", "amnios", "il-silenzio-di-dio"]);
  });

  it("builds the original-size cover URL from the art id", () => {
    expect(coverUrlForArt(656567531)).toBe("https://f4.bcbits.com/img/a0656567531_0.jpg");
  });

  it("parses the entity-encoded data-tralbum attribute of an album page", () => {
    const album = parseAlbumPage(fixture("bandcamp-album.html"), "https://oophoi.bandcamp.com/album/amnios");
    expect(album).toMatchObject({
      slug: "amnios",
      url: "https://oophoi.bandcamp.com/album/amnios",
      title: "Amnios",
      artist: "Oophoi",
      releaseDate: "2012-08-20",
      year: 2012,
      artId: 656567531,
      coverUrl: "https://f4.bcbits.com/img/a0656567531_0.jpg",
    });
    expect(album.tracks).toEqual([
      { title: "Liquos Part 1", seconds: 877.96 },
      { title: "Liquos Part 2", seconds: 864.827 },
      { title: "Aquos Part 1", seconds: 1348.04 },
      { title: "Aquos Part 2", seconds: 1095.75 },
    ]);
    expect(album.about).toMatch(/^"Amnios" is build on two lengthy suites/);
  });

  it("throws when the page carries no tralbum data", () => {
    expect(() => parseAlbumPage("<html></html>", "https://oophoi.bandcamp.com/album/x")).toThrow(/data-tralbum/);
  });
});

describe("Databloem", () => {
  it("lists the product links of the search results only, without query strings", () => {
    expect(parseSearchResults(fixture("databloem-search.html"))).toEqual([
      "https://databloem.com/home/108-oophoi-amnios.html",
      "https://databloem.com/home/1555-oophoi-dreams-part-one.html",
    ]);
  });

  it("derives the original image by dropping the size suffix", () => {
    expect(originalImageUrl("https://databloem.com/140-thickbox_default/oophoi-amnios.jpg")).toBe(
      "https://databloem.com/140/oophoi-amnios.jpg",
    );
  });

  it("parses the title, credit, reference, facts and description of a product page", () => {
    const product = parseProductPage(fixture("databloem-product.html"), "https://databloem.com/home/108-oophoi-amnios.html");
    expect(product).toMatchObject({
      id: 108,
      url: "https://databloem.com/home/108-oophoi-amnios.html",
      rawTitle: "Oophoi - amnios",
      credit: "Oophoi",
      title: "amnios",
      reference: "PN053",
      label: "PRACTISING NATURE",
      year: 2012,
      trackCount: 4,
      minutes: 69,
      packaging: "CDr in Two-Piece Jewelcase",
      images: ["https://databloem.com/140/oophoi-amnios.jpg"],
    });
    expect(product.description).toMatch(/^Re-mastered reissue of Oophoi's classic album from 2006/);
    expect(product.description).not.toMatch(/</);
  });
});
