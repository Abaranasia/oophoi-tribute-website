import { describe, expect, it } from "vitest";
import { matchAll, matchItem } from "./match.mjs";

const release = (slug: string, title: string, extra: Record<string, unknown> = {}) => ({
  slug,
  title,
  year: 2005,
  hidden: false,
  ...extra,
});

const releases = [
  release("amnios", "Amnios", { year: 2006 }),
  release("static-soundscapes", "Static Soundscapes: Three Lights At The End Of The World", { year: 1996 }),
  release("tf-1", "Time Fragments Vol. 1 - The Archives 1995/1997", { year: 2001 }),
  release("tf-4", "Time Fragments Vol. 4 - Garden Of Earthly Delights"),
  release("signals-complete", "Signals From The Great Beyond - The Complete Recordings", { year: 2006 }),
  release("the-dreams-of-shells", "The Dreams Of Shells", { year: 2003 }),
  release("dreams-part-one", "Dreams Part One", { year: 2006 }),
  release("camouflage", "Camouflage", { year: 2004, catalogNo: "KW 019" }),
  release("camouflage-693959", "Camouflage", { year: 2004, catalogNo: "KW 019", hidden: true, relatedTo: ["camouflage"] }),
  release("camouflage-4222226", "Camouflage", { year: 2004, catalogNo: "KW 019", hidden: true, relatedTo: ["camouflage"] }),
  release("twin-a", "Twin", { year: 2001, catalogNo: "A-1" }),
  release("twin-b", "Twin", { year: 2002, catalogNo: "B-2" }),
];

const item = (title: string, extra: Record<string, unknown> = {}) => ({ source: "bandcamp", id: title, title, ...extra });

describe("matchItem", () => {
  it("matches on the normalized full title", () => {
    expect(matchItem(item("Dreams part one"), releases)).toEqual({ status: "matched", slug: "dreams-part-one", kind: "exact" });
    expect(matchItem(item("time fragments vol 4: garden of earthly delights"), releases)).toMatchObject({
      status: "matched",
      slug: "tf-4",
      kind: "exact",
    });
  });

  it("matches a title equal to the subtitle after a series prefix", () => {
    expect(matchItem(item("Three Lights At The End Of The World"), releases)).toEqual({
      status: "matched",
      slug: "static-soundscapes",
      kind: "subtitle",
    });
  });

  it("uses the year as a tiebreaker between same-title releases", () => {
    expect(matchItem(item("Twin", { year: 2002 }), releases)).toMatchObject({ status: "matched", slug: "twin-b" });
  });

  it("uses the catalog number as a tiebreaker", () => {
    expect(matchItem(item("Twin", { catalogNo: "a 1" }), releases)).toMatchObject({ status: "matched", slug: "twin-a" });
  });

  it("falls back to the canonical release when the others are hidden versions of it", () => {
    expect(matchItem(item("Camouflage"), releases)).toEqual({ status: "matched", slug: "camouflage", kind: "exact (canonical version)" });
  });

  it("reports same-title releases it cannot tell apart as ambiguous", () => {
    expect(matchItem(item("Twin", { year: 2010 }), releases)).toEqual({
      status: "ambiguous",
      candidates: ["twin-a", "twin-b"],
      reason: "2 releases share this title",
    });
  });

  it("reports a same series volume with another subtitle as ambiguous, never as a match", () => {
    expect(matchItem(item("time fragments vol 1: lost memories"), releases)).toEqual({
      status: "ambiguous",
      candidates: ["tf-1"],
      reason: "same series volume, different subtitle",
    });
  });

  it("reports a title that is only the head of a longer release title as ambiguous", () => {
    expect(matchItem(item("signals from the great beyond"), releases)).toEqual({
      status: "ambiguous",
      candidates: ["signals-complete"],
      reason: "title is the first part of a longer release title",
    });
  });

  it("reports unmatched items with similar titles as suggestions", () => {
    expect(matchItem(item("the dreaming of shells"), releases)).toEqual({
      status: "unmatched",
      suggestions: ["the-dreams-of-shells"],
    });
    expect(matchItem(item("penumbra recollected 1"), releases)).toEqual({ status: "unmatched", suggestions: [] });
  });
});

describe("matchAll", () => {
  it("groups the results and keeps several items matching one release", () => {
    const result = matchAll([item("Amnios"), item("amnios", { source: "databloem", id: 108 }), item("Twin"), item("Nope")], releases);
    expect(result.matched.map((m: { slug: string }) => m.slug)).toEqual(["amnios", "amnios"]);
    expect(result.ambiguous).toHaveLength(1);
    expect(result.ambiguous[0].item.title).toBe("Twin");
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0].item.title).toBe("Nope");
  });
});
