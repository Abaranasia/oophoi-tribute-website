export interface Credit {
  alias?: string;
  with: string[];
}

/** "A", "A & B", "A, B & C" */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
}

/** Human-readable credit, e.g. "Oöphoi with Klaus Wiese" or "As Nebula, with Klaus Wiese & Tau Ceti". */
export function creditLine({ artist, credit }: { artist: string; credit: Credit }): string {
  const collaborators = joinNames(credit.with);
  if (credit.alias) {
    return collaborators ? `As ${credit.alias}, with ${collaborators}` : `As ${credit.alias}`;
  }
  return collaborators ? `${artist} with ${collaborators}` : artist;
}

interface Linkable {
  slug: string;
  hidden: boolean;
  relatedTo?: readonly string[];
}

/** Slugs of visible releases linked to or from `slug`, in a stable order. */
export function relatedSlugs(slug: string, releases: readonly Linkable[]): string[] {
  const visible = new Set(releases.filter((release) => !release.hidden).map((release) => release.slug));
  const own = releases.find((release) => release.slug === slug);
  const outgoing = own?.relatedTo ?? [];
  const incoming = releases
    .filter((release) => release.relatedTo?.includes(slug))
    .map((release) => release.slug);
  return [...new Set([...outgoing, ...incoming])].filter((candidate) => candidate !== slug && visible.has(candidate));
}
