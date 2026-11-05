// Cover choice: the artist's own Bandcamp upload, then the label shop, then Discogs.
export const COVER_PRIORITY = ["bandcamp", "databloem", "discogs"];

const longestSide = (size) => Math.max(size.width, size.height);
const measured = (candidate) => Number.isFinite(candidate.width) && Number.isFinite(candidate.height);

// `current` is the size of the existing cover, or null when the release has none.
export function selectCover(candidates, current) {
  const ranked = candidates
    .filter(measured)
    .map((candidate, order) => ({ candidate, order }))
    .sort((a, b) => COVER_PRIORITY.indexOf(a.candidate.source) - COVER_PRIORITY.indexOf(b.candidate.source) || a.order - b.order);
  const beatsCurrent = ({ candidate }) => !current || longestSide(candidate) > longestSide(current);
  return ranked.find(beatsCurrent)?.candidate ?? null;
}
