import { describe, expect, it } from "vitest";
import { discogsArtistUrl, discogsLabelUrl, discogsUrl } from "./discogs";

describe("discogsUrl", () => {
  it("builds canonical HTTPS URLs for masters and releases", () => {
    expect(discogsUrl({ kind: "master", id: 210906 })).toBe("https://www.discogs.com/master/210906");
    expect(discogsUrl({ kind: "release", id: 971584 })).toBe("https://www.discogs.com/release/971584");
  });

  it("rejects ids that are not positive integers", () => {
    expect(() => discogsUrl({ kind: "release", id: 0 })).toThrow();
    expect(() => discogsUrl({ kind: "release", id: 1.5 })).toThrow();
    expect(() => discogsUrl({ kind: "release", id: Number.NaN })).toThrow();
  });
});

describe("discogsArtistUrl / discogsLabelUrl", () => {
  it("builds the canonical `{id}-Name` form, percent-encoding non-ASCII letters", () => {
    expect(discogsArtistUrl("Oöphoi")).toBe("https://www.discogs.com/artist/162295-O%C3%B6phoi");
    expect(discogsArtistUrl("Klaus Wiese")).toBe("https://www.discogs.com/artist/228551-Klaus-Wiese");
    expect(discogsLabelUrl("Glacial Movements Records")).toBe("https://www.discogs.com/label/66779-Glacial-Movements-Records");
    expect(discogsLabelUrl("Prikosnovénie")).toBe("https://www.discogs.com/label/14641-Prikosnov%C3%A9nie");
  });

  it("drops punctuation from the name part", () => {
    expect(discogsArtistUrl("Paul Vnuk Jr.")).toBe("https://www.discogs.com/artist/19921-Paul-Vnuk-Jr");
    expect(discogsArtistUrl("L.E.M.")).toBe("https://www.discogs.com/artist/319055-L-E-M");
  });

  it("returns undefined for names whose Discogs id has not been verified", () => {
    expect(discogsLabelUrl("Amplexus")).toBeUndefined();
    expect(discogsArtistUrl("Faryus")).toBeUndefined();
  });
});
