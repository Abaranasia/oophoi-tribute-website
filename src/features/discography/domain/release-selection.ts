import { sortReleases, type ReleaseSummary } from "./release-groups";
import type { ReleaseType } from "./release-types";

interface Selectable extends ReleaseSummary {
  labels: readonly { name: string }[];
}

export interface ReleaseSelector {
  /** Label name, compared without case. */
  label?: string;
  types?: readonly ReleaseType[];
}

/** Visible releases matching every given criterion, sorted like the discography. */
export function selectReleases<T extends Selectable>(releases: readonly T[], { label, types }: ReleaseSelector): T[] {
  const labelKey = label?.toLowerCase();
  return sortReleases(
    releases.filter(
      (release) =>
        !release.hidden &&
        (labelKey === undefined || release.labels.some((candidate) => candidate.name.toLowerCase() === labelKey)) &&
        (types === undefined || types.includes(release.type)),
    ),
  );
}

/** Types that are Oöphoi's own records, as opposed to compilation tracks and Klaus Wiese remasters. */
const OWN_RELEASE_TYPES: readonly ReleaseType[] = ["album", "box", "ep", "minialbum"];

/** Number of Oöphoi's own visible releases (solo, collaborative and alias work). */
export const countOwnReleases = (releases: readonly Selectable[]): number =>
  selectReleases(releases, { types: OWN_RELEASE_TYPES }).length;
