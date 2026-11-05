import { OOPHOI_DISCOGS_ARTIST_ID } from "@features/shared/config/site";

export type DiscogsKind = "master" | "release";

export interface DiscogsRef {
  kind: DiscogsKind;
  id: number;
}

/** Canonical Discogs URL, built at render time so stored data never holds (possibly broken) legacy URLs. */
export function discogsUrl({ kind, id }: DiscogsRef): string {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid Discogs ${kind} id: ${id}`);
  }
  return `https://www.discogs.com/${kind}/${id}`;
}

// Discogs ids checked against api.discogs.com (artist and label credits of the releases in this
// collection) on 2026-11-03. Names that are not listed here are shown as plain text.
const DISCOGS_ARTIST_IDS: Readonly<Record<string, number>> = {
  "Oöphoi": OOPHOI_DISCOGS_ARTIST_ID,
  "Alio Die": 45771,
  "Aqua Dorsa": 1497795,
  "Enrico Coniglio": 846624,
  "Klaus Wiese": 228551,
  "L.E.M.": 319055,
  "Liquid Ghosts": 263766,
  "Lorenzo Pierobon": 436491,
  "Louisa John-Krol": 165353,
  "Mathias Grassow": 15803,
  "Mauro Malgrande": 566073,
  "Nebula": 436490,
  "Netherworld": 186564,
  "Paul Vnuk Jr.": 19921,
  "Ran Kirlian": 2070196,
  "Seren Ffordd": 323344,
  "Tau Ceti": 35992,
};

const DISCOGS_LABEL_IDS: Readonly<Record<string, number>> = {
  "Altera Orbe": 402204,
  "Aurora": 26507,
  "Databloem": 12839,
  "Electroshock Records": 12594,
  "Glacial Movements Records": 66779,
  "Hic Sunt Leones": 6911,
  "Hypnos": 1022,
  "Mystery Sea": 17762,
  "Nextera": 1039,
  "Penumbra": 57433,
  "Practising Nature": 54829,
  "Prikosnovénie": 14641,
  "Stella Maris": 55892,
  "The Kiva": 327198,
  "Umbra": 29993,
};

/** The readable part of a canonical Discogs URL: "Paul Vnuk Jr." → "Paul-Vnuk-Jr", "Oöphoi" → "O%C3%B6phoi". */
const nameSegment = (name: string) =>
  encodeURIComponent(
    name
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, ""),
  );

const entityUrl = (kind: "artist" | "label", ids: Readonly<Record<string, number>>, name: string) => {
  const id = ids[name];
  return id === undefined ? undefined : `https://www.discogs.com/${kind}/${id}-${nameSegment(name)}`;
};

/** Canonical `discogs.com/artist/{id}-Name` URL, or undefined when the artist's id is not verified. */
export const discogsArtistUrl = (name: string): string | undefined => entityUrl("artist", DISCOGS_ARTIST_IDS, name);

/** Canonical `discogs.com/label/{id}-Name` URL, or undefined when the label's id is not verified. */
export const discogsLabelUrl = (name: string): string | undefined => entityUrl("label", DISCOGS_LABEL_IDS, name);
