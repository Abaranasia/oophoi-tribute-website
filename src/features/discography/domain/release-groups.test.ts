import { describe, expect, it } from "vitest";
import { groupReleases, sortReleases, type ReleaseSummary } from "./release-groups";

const release = (overrides: Partial<ReleaseSummary>): ReleaseSummary => ({
  slug: "x",
  title: "X",
  type: "album",
  year: 2000,
  hidden: false,
  ...overrides,
});

describe("sortReleases", () => {
  it("orders by year, then catalogue number, then title", () => {
    const sorted = sortReleases([
      release({ slug: "b", title: "B", year: 2001 }),
      release({ slug: "kw2", title: "A", year: 2004, catalogNo: "KW 002" }),
      release({ slug: "kw1", title: "Z", year: 2004, catalogNo: "KW 001" }),
      release({ slug: "a", title: "A", year: 2001 }),
    ]);
    expect(sorted.map((r) => r.slug)).toEqual(["a", "b", "kw1", "kw2"]);
  });
});

describe("groupReleases", () => {
  it("returns the type groups in display order, omits empty groups and hidden releases", () => {
    const groups = groupReleases([
      release({ slug: "kw", type: "kw-remaster" }),
      release({ slug: "ep", type: "ep" }),
      release({ slug: "mini", type: "minialbum" }),
      release({ slug: "box", type: "box", year: 2011 }),
      release({ slug: "album", type: "album" }),
      release({ slug: "hidden", type: "kw-remaster", hidden: true }),
    ]);
    expect(groups.map((g) => [g.id, g.releases.map((r) => r.slug)])).toEqual([
      ["albums", ["album", "box"]],
      ["eps", ["ep", "mini"]],
      ["kw-remasters", ["kw"]],
    ]);
  });
});
