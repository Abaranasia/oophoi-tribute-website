import type { ReleaseType } from "./release-types";

/** The fields grouping and sorting need; collection entries are mapped to this shape. */
export interface ReleaseSummary {
  slug: string;
  title: string;
  type: ReleaseType;
  year: number;
  catalogNo?: string;
  hidden: boolean;
}

export interface ReleaseGroupDefinition {
  id: string;
  /** Section heading and filter chip text. */
  label: string;
  description: string;
  types: readonly ReleaseType[];
}

/** Display order of the discography sections (also used for the filter chips). */
export const RELEASE_GROUPS: readonly ReleaseGroupDefinition[] = [
  {
    id: "albums",
    label: "Albums",
    description: "Studio albums, collaborations and box sets.",
    types: ["album", "box"],
  },
  {
    id: "eps",
    label: "EPs & minis",
    description: "EPs and minialbums, many of them later collected on albums.",
    types: ["ep", "minialbum"],
  },
  {
    id: "compilations",
    label: "Compilations",
    description: "Tracks on various-artists compilations.",
    types: ["compilation-appearance"],
  },
  {
    id: "kw-remasters",
    label: "Klaus Wiese remasters",
    description: "Klaus Wiese albums released and remastered by Oöphoi between 2004 and 2007.",
    types: ["kw-remaster"],
  },
];

export interface ReleaseGroup<T extends ReleaseSummary> extends ReleaseGroupDefinition {
  releases: T[];
}

export function sortReleases<T extends ReleaseSummary>(releases: readonly T[]): T[] {
  return [...releases].sort(
    (a, b) =>
      a.year - b.year ||
      (a.catalogNo ?? "").localeCompare(b.catalogNo ?? "") ||
      a.title.localeCompare(b.title) ||
      a.slug.localeCompare(b.slug),
  );
}

/** Visible releases grouped by section, in display order; empty sections are omitted. */
export function groupReleases<T extends ReleaseSummary>(releases: readonly T[]): ReleaseGroup<T>[] {
  const visible = sortReleases(releases.filter((release) => !release.hidden));
  return RELEASE_GROUPS.map((group) => ({
    ...group,
    releases: visible.filter((release) => group.types.includes(release.type)),
  })).filter((group) => group.releases.length > 0);
}
