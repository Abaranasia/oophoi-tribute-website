// Maps a Bandcamp album or Databloem product to a release slug. It never guesses: anything that is not
// one unique, deterministic match comes back as ambiguous or unmatched, for the report.
import { normalizeTitle, titleKeys, tokenSimilarity } from "./normalize.mjs";

const SUGGESTION_THRESHOLD = 0.5;
const compactCatalog = (value) => (value ? normalizeTitle(value).replace(/ /g, "") : "");

function tiebreak(item, candidates) {
  let pool = candidates;
  if (item.year) {
    const sameYear = pool.filter((release) => release.year === item.year);
    if (sameYear.length > 0) pool = sameYear;
  }
  if (pool.length > 1 && item.catalogNo) {
    const sameCatalog = pool.filter((release) => compactCatalog(release.catalogNo) === compactCatalog(item.catalogNo));
    if (sameCatalog.length > 0) pool = sameCatalog;
  }
  if (pool.length === 1) return { release: pool[0], canonical: false };

  // Versioned slugs (camouflage, camouflage-693959, ...): hidden versions that all point at one visible release.
  const visible = pool.filter((release) => !release.hidden);
  if (visible.length === 1) {
    const [canonical] = visible;
    const others = pool.filter((release) => release !== canonical);
    if (others.every((release) => release.relatedTo?.includes(canonical.slug))) return { release: canonical, canonical: true };
  }
  return null;
}

/**
 * @param {{ title: string, year?: number | null, catalogNo?: string | null }} item
 * @param {Record<string, any>[]} releases
 */
export function matchItem(item, releases) {
  const keys = titleKeys(item.title);
  const indexed = releases.map((release) => ({ release, keys: titleKeys(release.title) }));

  let kind = "exact";
  let candidates = indexed.filter((entry) => entry.keys.full === keys.full);
  if (candidates.length === 0) {
    kind = "subtitle";
    candidates = indexed.filter(
      (entry) => (entry.keys.subtitle && entry.keys.subtitle === keys.full) || (keys.subtitle && keys.subtitle === entry.keys.full),
    );
  }

  if (candidates.length === 1) return { status: "matched", slug: candidates[0].release.slug, kind };
  if (candidates.length > 1) {
    const picked = tiebreak(
      item,
      candidates.map((entry) => entry.release),
    );
    if (picked) return { status: "matched", slug: picked.release.slug, kind: picked.canonical ? `${kind} (canonical version)` : `${kind} (tiebreak)` };
    return {
      status: "ambiguous",
      candidates: candidates.map((entry) => entry.release.slug),
      reason: `${candidates.length} releases share this title`,
    };
  }

  // Weak signals are reported for a human to confirm, never applied.
  if (keys.series) {
    const sameSeries = indexed.filter((entry) => entry.keys.series === keys.series);
    if (sameSeries.length > 0) {
      return { status: "ambiguous", candidates: sameSeries.map((entry) => entry.release.slug), reason: "same series volume, different subtitle" };
    }
  }
  const asHead = indexed.filter((entry) => entry.keys.head && entry.keys.head === keys.full);
  if (asHead.length > 0) {
    return { status: "ambiguous", candidates: asHead.map((entry) => entry.release.slug), reason: "title is the first part of a longer release title" };
  }

  const suggestions = indexed
    .map((entry) => ({ slug: entry.release.slug, score: tokenSimilarity(item.title, entry.release.title) }))
    .filter((entry) => entry.score >= SUGGESTION_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => entry.slug);
  return { status: "unmatched", suggestions };
}

/**
 * @param {{ source: string, id: unknown, title: string, year?: number | null, catalogNo?: string | null }[]} items
 * @param {Record<string, any>[]} releases
 * @returns {{ matched: any[], ambiguous: any[], unmatched: any[] }}
 */
export function matchAll(items, releases) {
  /** @type {{ matched: any[], ambiguous: any[], unmatched: any[] }} */
  const result = { matched: [], ambiguous: [], unmatched: [] };
  for (const item of items) {
    const outcome = matchItem(item, releases);
    if (outcome.status === "matched") result.matched.push({ item, slug: outcome.slug, kind: outcome.kind });
    else if (outcome.status === "ambiguous") result.ambiguous.push({ item, candidates: outcome.candidates, reason: outcome.reason });
    else result.unmatched.push({ item, suggestions: outcome.suggestions });
  }
  return result;
}
