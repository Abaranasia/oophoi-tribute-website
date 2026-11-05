import { describe, expect, it } from "vitest";
import { applyProposal, parseEnrichArgs } from "./apply.mjs";

const release = {
  title: "Amnios",
  slug: "amnios",
  type: "album",
  year: 2006,
  labels: [],
  credit: { with: [] },
  discogs: { kind: "master", id: 104529 },
  cover: "../../assets/covers/amnios.jpg",
  hidden: false,
};

const proposal = {
  slug: "amnios",
  cover: { source: "bandcamp", file: ".cache/enrich/covers/bandcamp-1.jpg", format: "jpeg", width: 1400, height: 1400 },
  fills: {
    catalogNo: { value: "UMB 01", source: "discogs" },
    format: { value: "CDr, Album", source: "discogs" },
    tracks: { value: [{ title: "Liquos Part 1", duration: "14:38" }], source: "bandcamp" },
  },
  conflicts: [{ field: "note", current: "x", sources: { discogs: "y" } }],
  note: { source: "discogs", text: "Long notes" },
};

describe("applyProposal", () => {
  it("fills empty fields, sets the cover and keeps the schema key order", () => {
    const { release: next, applied } = applyProposal({ ...release, cover: undefined }, proposal, { coverRef: "../../assets/covers/amnios.jpg" });
    expect(Object.keys(next)).toEqual([
      "title", "slug", "type", "year", "labels", "catalogNo", "format", "credit", "discogs", "cover", "tracks", "hidden",
    ]);
    expect(next.catalogNo).toBe("UMB 01");
    expect(next.tracks).toEqual([{ title: "Liquos Part 1", duration: "14:38" }]);
    expect(next.cover).toBe("../../assets/covers/amnios.jpg");
    expect(applied).toEqual(["cover", "catalogNo", "format", "tracks"]);
  });

  it("never applies conflicts or the proposed note", () => {
    const { release: next } = applyProposal(release, proposal, { coverRef: "../../assets/covers/amnios.jpg" });
    expect(next).not.toHaveProperty("note");
  });

  it("skips a field that was hand-edited after the proposal was made", () => {
    const { release: next, skipped } = applyProposal({ ...release, catalogNo: "MINE" }, proposal, { coverRef: "x" });
    expect(next.catalogNo).toBe("MINE");
    expect(skipped).toEqual(["catalogNo (no longer empty)"]);
  });

  it("fills missing durations of existing tracks only when the title still matches", () => {
    const withTracks = { ...release, tracks: [{ title: "Pool Of Life" }, { title: "Molecular Pulse", duration: "5:00" }] };
    const durations = {
      slug: "amnios",
      fills: {
        trackDurations: [
          { index: 0, title: "Pool of life", duration: "7:00", source: "discogs" },
          { index: 1, title: "Molecular Pulse", duration: "5:01", source: "discogs" },
        ],
      },
    };
    const { release: next, applied, skipped } = applyProposal(withTracks, durations, { coverRef: "x" });
    expect(next.tracks).toEqual([{ title: "Pool Of Life", duration: "7:00" }, { title: "Molecular Pulse", duration: "5:00" }]);
    expect(applied).toEqual(["tracks[0].duration"]);
    expect(skipped).toEqual(["tracks[1].duration (no longer empty)"]);
  });

  it("does not mutate its input", () => {
    const input = structuredClone(release);
    applyProposal(input, proposal, { coverRef: "x" });
    expect(input).toEqual(release);
  });
});

describe("parseEnrichArgs", () => {
  it("defaults to the fetch mode", () => {
    expect(parseEnrichArgs([])).toEqual({ apply: false, only: null });
  });

  it("parses --apply and a comma-separated --only list", () => {
    expect(parseEnrichArgs(["--apply", "--only", "amnios, upuaut"])).toEqual({ apply: true, only: ["amnios", "upuaut"] });
    expect(parseEnrichArgs(["--apply", "--only=amnios"])).toEqual({ apply: true, only: ["amnios"] });
  });

  it("rejects unknown flags and --only without --apply", () => {
    expect(() => parseEnrichArgs(["--force"])).toThrow(/Unknown argument/);
    expect(() => parseEnrichArgs(["--only", "amnios"])).toThrow(/--only requires --apply/);
    expect(() => parseEnrichArgs(["--apply", "--only"])).toThrow(/--only needs/);
  });
});
