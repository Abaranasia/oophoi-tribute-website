// Container-side access to the `releases` collection. Pure logic lives in the
// sibling modules so it can be unit tested without Astro.
import { getCollection, type CollectionEntry } from "astro:content";
import { groupReleases, sortReleases, type ReleaseGroup } from "./release-groups";
import { relatedSlugs } from "./release-format";

export type Release = CollectionEntry<"releases">;

/** Releases that get a page and appear in listings (hidden KW alternate versions are skipped). */
export async function getVisibleReleases(): Promise<Release[]> {
  const releases = await getCollection("releases", ({ data }) => !data.hidden);
  return sortByData(releases);
}

const sortByData = (releases: Release[]): Release[] => {
  const bySlug = new Map(releases.map((release) => [release.data.slug, release]));
  return sortReleases(releases.map(({ data }) => data)).map((data) => bySlug.get(data.slug)!);
};

export interface ReleaseSection extends Omit<ReleaseGroup<Release["data"]>, "releases"> {
  releases: Release[];
}

export async function getReleaseSections(): Promise<ReleaseSection[]> {
  const releases = await getVisibleReleases();
  const bySlug = new Map(releases.map((release) => [release.data.slug, release]));
  return groupReleases(releases.map(({ data }) => data)).map((group) => ({
    ...group,
    releases: group.releases.map((data) => bySlug.get(data.slug)!),
  }));
}

export async function getRelatedReleases(release: Release): Promise<Release[]> {
  const all = await getCollection("releases");
  const visible = new Map(all.filter(({ data }) => !data.hidden).map((entry) => [entry.data.slug, entry]));
  const slugs = relatedSlugs(
    release.data.slug,
    all.map(({ data }) => data),
  );
  return sortByData(slugs.map((slug) => visible.get(slug)!));
}

/** Releases picked for the home page, in the given order; unknown slugs are skipped. */
export async function getReleasesBySlug(slugs: readonly string[]): Promise<Release[]> {
  const releases = await getVisibleReleases();
  return slugs.flatMap((slug) => releases.find((release) => release.data.slug === slug) ?? []);
}
