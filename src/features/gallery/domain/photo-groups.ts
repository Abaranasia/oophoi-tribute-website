/** Gallery sections, in display order. */
export const PHOTO_GROUPS = [
  { id: "oophoi", heading: "Oöphoi" },
  { id: "tau-ceti", heading: "With Tau Ceti" },
  { id: "kristian-kotarac", heading: "With Kristian Kotarac" },
  { id: "faryus", heading: "With Faryus" },
  { id: "klaus-wiese", heading: "With Klaus Wiese" },
  { id: "live", heading: "Live" },
  { id: "other", heading: "Other photos" },
] as const;

export type PhotoGroupId = (typeof PHOTO_GROUPS)[number]["id"];

export const PHOTO_GROUP_IDS = PHOTO_GROUPS.map((group) => group.id) as [PhotoGroupId, ...PhotoGroupId[]];

interface Groupable {
  group: PhotoGroupId;
  /** Position inside its group. */
  order: number;
}

export interface PhotoGroup<T> {
  id: PhotoGroupId;
  heading: string;
  /** `index` is the photo's position across the whole gallery, used by the lightbox. */
  photos: (T & { index: number })[];
}

/** Photos grouped by section in display order; empty sections are omitted. */
export function groupPhotos<T extends Groupable>(photos: readonly T[]): PhotoGroup<T>[] {
  let index = 0;
  return PHOTO_GROUPS.map((group) => ({
    ...group,
    photos: photos
      .filter((photo) => photo.group === group.id)
      .sort((a, b) => a.order - b.order)
      .map((photo) => ({ ...photo, index: index++ })),
  })).filter((group) => group.photos.length > 0);
}
