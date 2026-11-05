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
