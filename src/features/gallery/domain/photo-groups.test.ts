import { describe, expect, it } from "vitest";
import { groupPhotos, PHOTO_GROUPS } from "./photo-groups";

const photo = (id: string, group: (typeof PHOTO_GROUPS)[number]["id"], order: number) => ({ id, group, order });

describe("groupPhotos", () => {
  it("returns the groups in display order with their photos sorted, omitting empty groups", () => {
    const groups = groupPhotos([
      photo("wiese-2", "klaus-wiese", 2),
      photo("portrait-2", "oophoi", 2),
      photo("wiese-1", "klaus-wiese", 1),
      photo("portrait-1", "oophoi", 1),
    ]);
    expect(groups.map((group) => [group.id, group.photos.map((p) => p.id)])).toEqual([
      ["oophoi", ["portrait-1", "portrait-2"]],
      ["klaus-wiese", ["wiese-1", "wiese-2"]],
    ]);
  });

  it("gives every group a heading", () => {
    const [group] = groupPhotos([photo("faryus", "faryus", 1)]);
    expect(group.heading).toBe("With Faryus");
  });

  it("numbers photos across groups, in display order, for the lightbox", () => {
    const groups = groupPhotos([photo("b", "tau-ceti", 1), photo("a", "oophoi", 1), photo("c", "tau-ceti", 2)]);
    expect(groups.flatMap((group) => group.photos.map((p) => [p.id, p.index]))).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 2],
    ]);
  });
});
