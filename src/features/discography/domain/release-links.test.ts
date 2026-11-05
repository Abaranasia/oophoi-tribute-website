import { describe, expect, it } from "vitest";
import { releaseLinkMap, releaseLinks } from "./release-links";

const releases = [
  { slug: "the-physics-of-heaven", title: "The Physics Of Heaven", hidden: false },
  { slug: "ruh-925627", title: "Ruh", hidden: true },
];

describe("releaseLinks", () => {
  it("links each referenced release to its page on this site, in the given order", () => {
    expect(releaseLinks(["the-physics-of-heaven"], releases)).toEqual([
      { title: "The Physics Of Heaven", href: "/discography/the-physics-of-heaven/" },
    ]);
  });

  it("fails the build on a slug that has no page, so a typo never ships a broken link", () => {
    expect(() => releaseLinks(["the-physics-of-hell"], releases)).toThrow(/the-physics-of-hell/);
    expect(() => releaseLinks(["ruh-925627"], releases)).toThrow(/ruh-925627/);
  });
});

describe("releaseLinkMap", () => {
  it("looks up release page links by slug", () => {
    const links = releaseLinkMap(["the-physics-of-heaven"], releases);
    expect(links["the-physics-of-heaven"]).toEqual({ title: "The Physics Of Heaven", href: "/discography/the-physics-of-heaven/" });
  });

  it("fails on unknown slugs like releaseLinks", () => {
    expect(() => releaseLinkMap(["missing"], releases)).toThrow(/missing/);
  });
});
