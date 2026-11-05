import { describe, expect, it } from "vitest";
import { computeTotals, renderReport } from "./report.mjs";

const proposals = [
  {
    slug: "amnios",
    title: "Amnios",
    year: 2006,
    matches: [
      { source: "bandcamp", id: "amnios", kind: "exact" },
      { source: "databloem", id: 108, kind: "exact" },
    ],
    cover: { source: "bandcamp", width: 1400, height: 1400, current: { width: 90, height: 90 } },
    fills: {
      tracks: { value: [{ title: "A", duration: "1:00" }, { title: "B" }], source: "discogs + bandcamp durations" },
      catalogNo: { value: "UMB 01", source: "discogs" },
    },
    conflicts: [{ field: "format", current: "Album", sources: { discogs: "CDr, Album" } }],
    disagreements: [],
    otherEditions: [],
    note: { source: "discogs", text: "x".repeat(500) },
  },
  {
    slug: "camouflage",
    title: "Camouflage",
    year: 2004,
    matches: [],
    cover: { source: "discogs", width: 600, height: 600, current: null },
    fills: {},
    conflicts: [],
    disagreements: [],
    otherEditions: [],
  },
  { slug: "quiet", title: "Quiet", year: 2001, matches: [], cover: null, fills: {}, conflicts: [], disagreements: [], otherEditions: [] },
];

const unmatched = [{ item: { source: "databloem", id: 87, title: "the dreaming of shells", url: "u" }, suggestions: ["the-dreams-of-shells"] }];
const ambiguous = [{ item: { source: "bandcamp", id: "signals", title: "signals from the great beyond", url: "u" }, candidates: ["signals-complete"], reason: "r" }];

describe("computeTotals", () => {
  it("counts covers by source with the average gain over existing covers", () => {
    expect(computeTotals(proposals)).toMatchObject({
      releases: 3,
      withChanges: 2,
      covers: { total: 2, bySource: { bandcamp: 1, discogs: 1 }, replacing: 1, new: 1, averageGain: 1400 / 90 },
      tracklists: 1,
      trackDurations: 0,
      catalogNo: 1,
      format: 0,
      conflicts: 1,
      notes: 1,
    });
  });
});

describe("renderReport", () => {
  const markdown = renderReport({ proposals, unmatched, ambiguous, generatedAt: "2026-11-04T00:00:00.000Z" });

  it("summarises each release that has something to propose, and skips the others", () => {
    expect(markdown).toContain("### amnios: Amnios (2006)");
    expect(markdown).toContain("Cover: Bandcamp 1400×1400 (current 90×90)");
    expect(markdown).toContain("Fill tracks: 2 tracks, 1 with duration (discogs + bandcamp durations)");
    expect(markdown).toContain("Fill catalogNo: `UMB 01` (discogs)");
    expect(markdown).toContain("Conflict format: current `Album`; discogs `CDr, Album`");
    expect(markdown).toContain("Cover: Discogs 600×600 (no current cover)");
    expect(markdown).not.toContain("### quiet");
  });

  it("shortens proposed notes instead of dumping them", () => {
    expect(markdown).toMatch(/Note proposal \(discogs, 500 chars\): "x{100}…"/);
  });

  it("lists unmatched and ambiguous items by name and ends with totals", () => {
    expect(markdown).toContain("the dreaming of shells");
    expect(markdown).toContain("similar: the-dreams-of-shells");
    expect(markdown).toContain("signals from the great beyond");
    expect(markdown).toContain("candidates: signals-complete");
    expect(markdown.indexOf("## Totals")).toBeGreaterThan(markdown.indexOf("## Unmatched"));
  });
});
