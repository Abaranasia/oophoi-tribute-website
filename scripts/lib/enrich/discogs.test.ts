import { describe, expect, it } from "vitest";
import { formatDuration, mapCatalogNo, mapFormat, mapTracklist, primaryImage, summarizeDiscogs } from "./discogs.mjs";

// Same pattern as the schema in src/content.config.ts.
const durationRegex = /^(?:\d{1,2}:)?\d{1,2}:\d{2}$/;

describe("formatDuration", () => {
  it("formats seconds as m:ss or h:mm:ss", () => {
    expect(formatDuration(877.96)).toBe("14:38");
    expect(formatDuration(59.4)).toBe("0:59");
    expect(formatDuration(3823)).toBe("1:03:43");
  });

  it("normalizes Discogs strings, moving minutes past 59 into hours", () => {
    expect(formatDuration("6:50")).toBe("6:50");
    expect(formatDuration("06:50")).toBe("6:50");
    expect(formatDuration("63:43")).toBe("1:03:43");
    expect(formatDuration("1:03:43")).toBe("1:03:43");
  });

  it("returns undefined for empty or malformed values", () => {
    expect(formatDuration("")).toBeUndefined();
    expect(formatDuration("6.50")).toBeUndefined();
    expect(formatDuration("6:75")).toBeUndefined();
    expect(formatDuration(0)).toBeUndefined();
    expect(formatDuration(undefined)).toBeUndefined();
  });

  it("always produces values the schema accepts", () => {
    for (const value of [1, 61, 599, 3599, 3600, 35999, "9:59", "99:59"]) {
      expect(formatDuration(value)).toMatch(durationRegex);
    }
  });
});

describe("mapTracklist", () => {
  const tracklist = [
    { type_: "heading", title: "Liquos", duration: "" },
    { type_: "track", position: "1", title: " Pool Of Life ", duration: "14:38" },
    { type_: "index", title: "Suite", duration: "20:00", sub_tracks: [{ type_: "track", title: "Inner" }] },
    { type_: "track", position: "2", title: "Molecular Pulse", duration: "" },
    { type_: "track", position: "3", title: "", duration: "1:00" },
  ];

  it("keeps real tracks only and formats their durations", () => {
    expect(mapTracklist(tracklist)).toEqual([{ title: "Pool Of Life", duration: "14:38" }, { title: "Molecular Pulse" }]);
  });

  it("can keep only the tracks credited to the given artists, for compilations", () => {
    const compilation = [
      { type_: "track", title: "Cold Sun", duration: "6:50", artists: [{ name: "Oöphoi" }] },
      { type_: "track", title: "Other", duration: "5:00", artists: [{ name: "Somebody Else" }] },
    ];
    expect(mapTracklist(compilation, { artistFilter: (name: string) => name.startsWith("O") })).toEqual([
      { title: "Cold Sun", duration: "6:50" },
    ]);
  });
});

describe("mapFormat", () => {
  it("renders Discogs formats in the abbreviated style used by the release files", () => {
    expect(mapFormat([{ name: "CDr", qty: "1", descriptions: ["Album", "Reissue", "Remastered"] }])).toBe("CDr, Album, RE, RM");
    expect(mapFormat([{ name: "CDr", qty: "7", descriptions: ["Mini-Album", "Limited Edition"] }])).toBe("7xCDr, Mini, Ltd");
    expect(mapFormat([{ name: "CD", qty: "2", descriptions: ["Compilation"], text: "Digipak" }])).toBe("2xCD, Comp, Digipak");
    expect(mapFormat([{ name: "CD", qty: "1" }, { name: "DVD", qty: "1", descriptions: ["NTSC"] }])).toBe("CD + DVD, NTSC");
  });

  it("returns undefined without formats", () => {
    expect(mapFormat([])).toBeUndefined();
    expect(mapFormat(undefined)).toBeUndefined();
  });
});

describe("mapCatalogNo", () => {
  it("takes the first real catalog number", () => {
    expect(mapCatalogNo([{ name: "A", catno: "none" }, { name: "B", catno: " ERA 2043-2 " }])).toBe("ERA 2043-2");
    expect(mapCatalogNo([{ name: "A", catno: "None" }])).toBeUndefined();
    expect(mapCatalogNo(undefined)).toBeUndefined();
  });
});

describe("primaryImage", () => {
  it("prefers the primary image, then the first one", () => {
    const secondary = { type: "secondary", uri: "s.jpg", width: 433, height: 600 };
    const primary = { type: "primary", uri: "p.jpg", width: 600, height: 600 };
    expect(primaryImage([secondary, primary])).toEqual({ url: "p.jpg", width: 600, height: 600, primary: true });
    expect(primaryImage([secondary])).toEqual({ url: "s.jpg", width: 433, height: 600, primary: false });
    expect(primaryImage(undefined)).toBeNull();
  });
});

describe("summarizeDiscogs", () => {
  const releaseJson = {
    id: 728707,
    year: 2006,
    labels: [{ name: "Umbra", catno: "UMB 01" }],
    formats: [{ name: "CDr", qty: "1", descriptions: ["Album"] }],
    tracklist: [{ type_: "track", title: "Pool Of Life", duration: "" }],
    images: [{ type: "primary", uri: "p.jpg", width: 600, height: 600 }],
    notes: "  Recorded in 2005.\r\n ",
  };

  it("maps a release document", () => {
    expect(summarizeDiscogs({ release: releaseJson })).toEqual({
      releaseId: 728707,
      catalogNo: "UMB 01",
      format: "CDr, Album",
      tracks: [{ title: "Pool Of Life" }],
      image: { url: "p.jpg", width: 600, height: 600, primary: true },
      notes: "Recorded in 2005.",
    });
  });

  it("uses the master's own tracklist and image when present, and its main release for the rest", () => {
    const master = {
      id: 104529,
      main_release: 728707,
      tracklist: [{ type_: "track", title: "Master Track", duration: "5:00" }],
      images: [{ type: "primary", uri: "m.jpg", width: 500, height: 500 }],
    };
    expect(summarizeDiscogs({ master, release: releaseJson })).toMatchObject({
      releaseId: 728707,
      catalogNo: "UMB 01",
      tracks: [{ title: "Master Track", duration: "5:00" }],
      image: { url: "m.jpg" },
    });
  });

  it("prefers the main release's primary image over a master's secondary-only images", () => {
    const master = { id: 1, main_release: 728707, images: [{ type: "secondary", uri: "back.jpg", width: 433, height: 600 }] };
    expect(summarizeDiscogs({ master, release: releaseJson }).image).toMatchObject({ url: "p.jpg", primary: true });
  });

  it("fills durations missing on the master from its main release when the tracks line up", () => {
    const master = { id: 1, main_release: 728707, tracklist: [{ type_: "track", title: "Pool of life", duration: "" }] };
    const release = { ...releaseJson, tracklist: [{ type_: "track", title: "Pool Of Life", duration: "14:38" }] };
    expect(summarizeDiscogs({ master, release }).tracks).toEqual([{ title: "Pool of life", duration: "14:38" }]);
  });
});
