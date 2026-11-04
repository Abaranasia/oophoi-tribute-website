import { describe, expect, it } from "vitest";
import { buildProposal } from "./merge.mjs";

const base = {
  title: "Amnios",
  slug: "amnios",
  type: "album",
  year: 2006,
  labels: [],
  credit: { with: [] },
  discogs: { kind: "master", id: 104529 },
  hidden: false,
};

const discogs = (extra: Record<string, unknown> = {}) => ({
  releaseId: 728707,
  catalogNo: "UMB 01",
  format: "CDr, Album",
  tracks: [{ title: "Liquos Part 1" }, { title: "Aquos Part 1" }],
  image: null,
  notes: undefined,
  ...extra,
});

const bandcampAlbum = (tracks: { title: string; seconds: number }[]) => ({ slug: "amnios", title: "Amnios", tracks });

describe("buildProposal: scalar fields", () => {
  it("fills empty catalogNo and format from Discogs", () => {
    const proposal = buildProposal({ release: base, discogs: discogs(), bandcamp: [], databloem: [] });
    expect(proposal.fills.catalogNo).toEqual({ value: "UMB 01", source: "discogs" });
    expect(proposal.fills.format).toEqual({ value: "CDr, Album", source: "discogs" });
    expect(proposal.conflicts).toEqual([]);
  });

  it("keeps a hand-edited value and records a conflict when Discogs differs", () => {
    const proposal = buildProposal({ release: { ...base, catalogNo: "UMB 1", format: "cdr,  album" }, discogs: discogs(), bandcamp: [], databloem: [] });
    expect(proposal.fills.catalogNo).toBeUndefined();
    expect(proposal.fills.format).toBeUndefined();
    expect(proposal.conflicts).toEqual([{ field: "catalogNo", current: "UMB 1", sources: { discogs: "UMB 01" } }]);
  });

  it("lists the Databloem reference as another edition, never as a fill or conflict", () => {
    const proposal = buildProposal({
      release: base,
      discogs: null,
      bandcamp: [],
      databloem: [{ id: 108, reference: "PN053", year: 2012 }],
    });
    expect(proposal.fills).toEqual({});
    expect(proposal.conflicts).toEqual([]);
    expect(proposal.otherEditions).toEqual([{ source: "databloem", id: 108, catalogNo: "PN053", year: 2012 }]);
  });

  it("never proposes protected fields", () => {
    const proposal = buildProposal({ release: base, discogs: discogs(), bandcamp: [], databloem: [] });
    for (const field of ["title", "slug", "type", "year", "hidden", "relatedTo", "credit", "note"]) {
      expect(proposal.fills).not.toHaveProperty(field);
    }
  });
});

describe("buildProposal: tracks", () => {
  it("takes the Discogs tracklist and completes its durations from Bandcamp when the titles line up", () => {
    const proposal = buildProposal({
      release: base,
      discogs: discogs({ tracks: [{ title: "Liquos Part 1" }, { title: "Aquos Part 1", duration: "22:28" }] }),
      bandcamp: [bandcampAlbum([{ title: "Liquos part 1", seconds: 877.96 }, { title: "Aquos Part 1", seconds: 1348.04 }])],
      databloem: [],
    });
    expect(proposal.fills.tracks).toEqual({
      value: [
        { title: "Liquos Part 1", duration: "14:38" },
        { title: "Aquos Part 1", duration: "22:28" },
      ],
      source: "discogs + bandcamp durations",
    });
    expect(proposal.disagreements).toEqual([]);
  });

  it("keeps the Discogs tracklist and records a disagreement when Bandcamp lists other tracks", () => {
    const proposal = buildProposal({
      release: base,
      discogs: discogs({ tracks: [{ title: "Pool Of Life" }] }),
      bandcamp: [bandcampAlbum([{ title: "Liquos Part 1", seconds: 877.96 }])],
      databloem: [],
    });
    expect(proposal.fills.tracks).toEqual({ value: [{ title: "Pool Of Life" }], source: "discogs" });
    expect(proposal.disagreements).toEqual([
      { field: "tracks", sources: { discogs: ["Pool Of Life"], bandcamp: ["Liquos Part 1 (14:38)"] } },
    ]);
  });

  it("falls back to the Bandcamp tracklist without Discogs tracks", () => {
    const proposal = buildProposal({
      release: base,
      discogs: discogs({ tracks: [] }),
      bandcamp: [bandcampAlbum([{ title: "Liquos Part 1", seconds: 877.96 }])],
      databloem: [],
    });
    expect(proposal.fills.tracks).toEqual({ value: [{ title: "Liquos Part 1", duration: "14:38" }], source: "bandcamp" });
  });

  it("ignores Bandcamp albums for compilation appearances", () => {
    const proposal = buildProposal({
      release: { ...base, type: "compilation-appearance" },
      discogs: discogs({ tracks: [] }),
      bandcamp: [bandcampAlbum([{ title: "Liquos Part 1", seconds: 877.96 }])],
      databloem: [],
    });
    expect(proposal.fills.tracks).toBeUndefined();
  });

  it("fills only the missing durations of hand-edited tracks", () => {
    const proposal = buildProposal({
      release: { ...base, tracks: [{ title: "Liquos Part 1" }, { title: "Aquos Part 1", duration: "22:27" }] },
      discogs: discogs({ tracks: [{ title: "Liquos Part 1", duration: "14:38" }, { title: "Aquos Part 1", duration: "22:28" }] }),
      bandcamp: [],
      databloem: [],
    });
    expect(proposal.fills.tracks).toBeUndefined();
    expect(proposal.fills.trackDurations).toEqual([{ index: 0, title: "Liquos Part 1", duration: "14:38", source: "discogs" }]);
    // 22:27 against 22:28 is within the rounding tolerance.
    expect(proposal.conflicts).toEqual([]);
  });

  it("records a conflict for a hand-edited duration that clearly differs", () => {
    const proposal = buildProposal({
      release: { ...base, tracks: [{ title: "Liquos Part 1", duration: "10:00" }, { title: "Aquos Part 1" }] },
      discogs: discogs({ tracks: [{ title: "Liquos Part 1", duration: "14:38" }, { title: "Aquos Part 1" }] }),
      bandcamp: [],
      databloem: [],
    });
    expect(proposal.conflicts).toEqual([{ field: "tracks[0].duration", current: "10:00", sources: { discogs: "14:38" } }]);
  });

  it("records a tracklist conflict when the hand-edited tracks do not line up", () => {
    const proposal = buildProposal({
      release: { ...base, tracks: [{ title: "Mare Imbrium", duration: "1:03:43" }] },
      discogs: discogs(),
      bandcamp: [],
      databloem: [],
    });
    expect(proposal.fills.trackDurations).toBeUndefined();
    expect(proposal.conflicts).toEqual([
      { field: "tracks", current: ["Mare Imbrium (1:03:43)"], sources: { discogs: ["Liquos Part 1", "Aquos Part 1"] } },
    ]);
  });
});

describe("buildProposal: note", () => {
  it("proposes the Discogs notes for an empty note, without filling it", () => {
    const proposal = buildProposal({ release: base, discogs: discogs({ notes: "Recorded live." }), bandcamp: [], databloem: [] });
    expect(proposal.note).toEqual({ source: "discogs", text: "Recorded live." });
    expect(proposal.fills).not.toHaveProperty("note");
  });

  it("proposes nothing when a note exists", () => {
    const proposal = buildProposal({ release: { ...base, note: "Mine" }, discogs: discogs({ notes: "Theirs" }), bandcamp: [], databloem: [] });
    expect(proposal.note).toBeUndefined();
    expect(proposal.conflicts).toEqual([]);
  });
});
