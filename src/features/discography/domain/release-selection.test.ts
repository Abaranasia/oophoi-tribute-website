import { describe, expect, it } from "vitest";
import { countOwnReleases, selectReleases } from "./release-selection";
import type { ReleaseType } from "./release-types";

const release = (slug: string, type: ReleaseType, labels: string[], overrides: { year?: number; hidden?: boolean } = {}) => ({
  slug,
  title: slug,
  type,
  year: overrides.year ?? 2005,
  hidden: overrides.hidden ?? false,
  labels: labels.map((name) => ({ name })),
});

const all = [
  release("amnios", "album", ["Umbra"], { year: 2006 }),
  release("lightnoise", "compilation-appearance", ["umbra"], { year: 2005 }),
  release("ep-collection-vol-1", "album", ["Penumbra"]),
  release("algol", "ep", ["Penumbra"]),
  release("ruh", "kw-remaster", []),
  release("ruh-925627", "kw-remaster", [], { hidden: true }),
  release("athlit", "album", ["Hypnos"]),
];

const slugs = (releases: { slug: string }[]) => releases.map((r) => r.slug);

describe("selectReleases", () => {
  it("finds the visible releases on a label by name, ignoring case, sorted by year", () => {
    expect(slugs(selectReleases(all, { label: "Umbra" }))).toEqual(["lightnoise", "amnios"]);
  });

  it("does not confuse a label with its sublabel", () => {
    expect(slugs(selectReleases(all, { label: "Penumbra" }))).toEqual(["algol", "ep-collection-vol-1"]);
  });

  it("selects by type, skipping hidden alternate versions", () => {
    expect(slugs(selectReleases(all, { types: ["kw-remaster"] }))).toEqual(["ruh"]);
  });

  it("combines label and type", () => {
    expect(slugs(selectReleases(all, { label: "Penumbra", types: ["ep", "minialbum"] }))).toEqual(["algol"]);
  });
});

describe("countOwnReleases", () => {
  it("counts visible albums, box sets, EPs and minialbums, not compilation appearances or Klaus Wiese remasters", () => {
    expect(countOwnReleases(all)).toBe(4);
  });
});
