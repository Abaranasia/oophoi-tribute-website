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

/** Credit for running text: an alias is attributed to the release's own artist ("Klaus Wiese as …"). */
function creditPhrase({ artist, credit }: { artist: string; credit: Credit }): string {
  if (!credit.alias) return creditLine({ artist, credit });
  const collaborators = joinNames(credit.with);
  return collaborators ? `${artist} as ${credit.alias}, with ${collaborators}` : `${artist} as ${credit.alias}`;
}

/** "Album" → "album", but "EP" and "Klaus Wiese remaster" keep their capitals. */
const typeInSentence = (typeLabel: string) =>
  /^[A-Z][a-z]+\b(?! [A-Z])/.test(typeLabel) ? typeLabel.charAt(0).toLowerCase() + typeLabel.slice(1) : typeLabel;

export interface ReleaseDescriptionInput {
  title: string;
  year: number;
  typeLabel: string;
  artist: string;
  credit: Credit;
  labels: readonly string[];
}

/** Meta description of a release page, e.g. "Genesis (2002), album by Oöphoi as Nebula, with … on Stella Maris." */
export function releaseDescription({ title, year, typeLabel, artist, credit, labels }: ReleaseDescriptionInput): string {
  const on = labels.length > 0 ? ` on ${labels.join(", ")}` : "";
  return `${title} (${year}), ${typeInSentence(typeLabel)} by ${creditPhrase({ artist, credit })}${on}.`;
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
