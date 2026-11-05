import { describe, expect, it } from "vitest";
import { discogsUrl } from "./discogs";

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
