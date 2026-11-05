export const RELEASE_TYPES = [
  "album",
  "ep",
  "minialbum",
  "compilation-appearance",
  "box",
  "kw-remaster",
] as const;

export type ReleaseType = (typeof RELEASE_TYPES)[number];

export const RELEASE_TYPE_LABELS: Record<ReleaseType, string> = {
  album: "Album",
  ep: "EP",
  minialbum: "Minialbum",
  "compilation-appearance": "Compilation appearance",
  box: "Box set",
  "kw-remaster": "Klaus Wiese remaster",
};
