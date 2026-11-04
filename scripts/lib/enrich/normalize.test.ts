import { describe, expect, it } from "vitest";
import { decodeEntities, isOophoiCredit, normalizeTitle, splitCredit, titleKeys, tokenSimilarity } from "./normalize.mjs";

describe("decodeEntities", () => {
  it("decodes the named and numeric entities found on Bandcamp and Databloem pages", () => {
    expect(decodeEntities("O&ouml;phoi &amp; Tau Ceti &lrm;&ndash; x")).toBe("Oöphoi & Tau Ceti ‎– x");
    expect(decodeEntities("&quot;a&quot; &#39;b&#39; &#x27;c&#x27; Nebul&aelig;")).toBe("\"a\" 'b' 'c' Nebulæ");
  });

  it("leaves unknown entities untouched", () => {
    expect(decodeEntities("a &bogus; b")).toBe("a &bogus; b");
  });
});

describe("normalizeTitle", () => {
  it("lowercases, strips diacritics and punctuation", () => {
    expect(normalizeTitle("Static Soundscapes: Three Lights At The End Of The World")).toBe(
      "static soundscapes three lights at the end of the world",
    );
    expect(normalizeTitle("Nebulæ – Der Weg")).toBe("nebulae der weg");
  });

  it("drops a leading Oophoi credit in any spelling", () => {
    expect(normalizeTitle("Oophoi - amnios")).toBe("amnios");
    expect(normalizeTitle("Oöphoi – Upuaut")).toBe("upuaut");
  });

  it("unifies volume and part numbering", () => {
    expect(normalizeTitle("Time Fragments Volume 4")).toBe("time fragments vol 4");
    expect(normalizeTitle("Time Fragments Vol. 4")).toBe("time fragments vol 4");
    expect(normalizeTitle("EP Collection Vol.3")).toBe("ep collection vol 3");
    expect(normalizeTitle("Electroacoustic Music. Vol. VII")).toBe("electroacoustic music vol 7");
    expect(normalizeTitle("Dreams part one")).toBe("dreams part 1");
    expect(normalizeTitle("Dreams Part Three")).toBe("dreams part 3");
  });

  it("keeps years, which tell box-set volumes apart", () => {
    expect(normalizeTitle("Time Fragments Vol. 1 - The Archives 1995/1997")).toBe("time fragments vol 1 the archives 1995 1997");
  });

  it("drops edition qualifiers in parentheses", () => {
    expect(normalizeTitle("arpe di sabbia (2 CD)")).toBe("arpe di sabbia");
    expect(normalizeTitle("life lights in the shadow (2cd)")).toBe("life lights in the shadow");
    expect(normalizeTitle("Dreamfields (Remastered)")).toBe("dreamfields");
  });

  it("treats & and 'and' alike", () => {
    expect(normalizeTitle("Sun & Moon")).toBe(normalizeTitle("Sun And Moon"));
  });
});

describe("splitCredit", () => {
  it("splits the artist credit from the title on the first spaced separator", () => {
    expect(splitCredit("Oophoi - amnios")).toEqual({ credit: "Oophoi", title: "amnios" });
    expect(splitCredit("O&ouml;phoi &amp; Tau Ceti : archaic oceans")).toEqual({ credit: "Oöphoi & Tau Ceti", title: "archaic oceans" });
    expect(splitCredit("Seren Ffordd &amp; O&ouml;phoi &lrm;&ndash; the martian chronicles")).toEqual({
      credit: "Seren Ffordd & Oöphoi",
      title: "the martian chronicles",
    });
  });

  it("keeps an unspaced colon inside the title", () => {
    expect(splitCredit("Oophoi - time fragments vol 6: between nothingness and eternity")).toEqual({
      credit: "Oophoi",
      title: "time fragments vol 6: between nothingness and eternity",
    });
  });

  it("returns a null credit when there is no separator", () => {
    expect(splitCredit("Amnios")).toEqual({ credit: null, title: "Amnios" });
  });
});

describe("isOophoiCredit", () => {
  it("recognises Oophoi in any spelling and the known aliases", () => {
    expect(isOophoiCredit("Paul Vnuk Jr. & Oöphoi")).toBe(true);
    expect(isOophoiCredit("Aqua Dorsa (Oophoi & Enrico Coniglio)")).toBe(true);
    expect(isOophoiCredit("Nebulæ", ["Nebula", "Nebulae"])).toBe(true);
    expect(isOophoiCredit("Samora")).toBe(false);
    expect(isOophoiCredit(null)).toBe(false);
  });
});

describe("titleKeys", () => {
  it("derives the full key, the subtitle after a colon and the series volume", () => {
    expect(titleKeys("Static Soundscapes: Three Lights At The End Of The World")).toEqual({
      full: "static soundscapes three lights at the end of the world",
      subtitle: "three lights at the end of the world",
      head: "static soundscapes",
      series: null,
    });
    expect(titleKeys("Time Fragments Vol. 1 - The Archives 1995/1997")).toEqual({
      full: "time fragments vol 1 the archives 1995 1997",
      subtitle: null,
      head: "time fragments vol 1",
      series: "time fragments vol 1",
    });
    expect(titleKeys("Amnios")).toEqual({ full: "amnios", subtitle: null, head: null, series: null });
  });
});

describe("tokenSimilarity", () => {
  it("is the Jaccard index of the title words", () => {
    expect(tokenSimilarity("the dreaming of shells", "the dreams of shells")).toBeCloseTo(3 / 5);
    expect(tokenSimilarity("amnios", "amnios")).toBe(1);
    expect(tokenSimilarity("amnios", "upuaut")).toBe(0);
  });
});
