interface Linkable {
  slug: string;
  title: string;
  hidden: boolean;
}

export interface ReleaseLink {
  title: string;
  href: string;
}

/**
 * Links to release pages on this site, in the given order. An unknown or hidden slug throws, so a
 * typo in hand-written content fails the build instead of shipping a broken link.
 */
export function releaseLinks(slugs: readonly string[], releases: readonly Linkable[]): ReleaseLink[] {
  const visible = new Map(releases.filter((release) => !release.hidden).map((release) => [release.slug, release]));
  return slugs.map((slug) => {
    const release = visible.get(slug);
    if (!release) throw new Error(`No release page for slug "${slug}"`);
    return { title: release.title, href: `/discography/${release.slug}/` };
  });
}

/** The same links keyed by slug, for prose that links releases inline. */
export function releaseLinkMap<S extends string>(slugs: readonly S[], releases: readonly Linkable[]): Record<S, ReleaseLink> {
  const links = releaseLinks(slugs, releases);
  return Object.fromEntries(slugs.map((slug, index) => [slug, links[index]])) as Record<S, ReleaseLink>;
}

/** Throws on an unknown or hidden slug, for content that lists releases without linking them inline. */
export function assertReleasePages(slugs: readonly string[], releases: readonly Linkable[]): void {
  releaseLinks(slugs, releases);
}
