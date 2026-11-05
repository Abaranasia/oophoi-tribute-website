// Maps Discogs API documents (https://api.discogs.com/releases/{id}, /masters/{id}) to release-file values.
import { normalizeTitle } from "./normalize.mjs";

export const DISCOGS_API = "https://api.discogs.com";

const pad = (value) => String(value).padStart(2, "0");

// Seconds or "m:ss" / "mm:ss" / "h:mm:ss" (minutes may exceed 59) to the schema's m:ss or h:mm:ss.
export function formatDuration(input) {
  let seconds;
  if (typeof input === "number") {
    seconds = Math.round(input);
  } else if (typeof input === "string") {
    const match = input.trim().match(/^(?:(\d+):)?(\d+):(\d{2})$/);
    if (!match || Number(match[3]) > 59) return undefined;
    seconds = Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  } else {
    return undefined;
  }
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

// Headings and index tracks (suites with sub-tracks) are not playable tracks.
/**
 * @param {Record<string, any>[] | undefined} tracklist
 * @param {{ artistFilter?: (name: string) => boolean }} [options]
 * @returns {{ title: string, duration?: string }[]}
 */
export function mapTracklist(tracklist, { artistFilter } = {}) {
  return (tracklist ?? [])
    .filter((track) => (track.type_ ?? "track") === "track" && track.title?.trim())
    .filter((track) => !artistFilter || (track.artists ?? []).some((artist) => artistFilter(artist.name ?? "")))
    .map((track) => {
      const duration = formatDuration(track.duration);
      return duration ? { title: track.title.trim(), duration } : { title: track.title.trim() };
    });
}

// Discogs' own abbreviations, as they appear in the release files ("CDr, Album, RE, RM").
const DESCRIPTION_ABBREVIATIONS = {
  "Limited Edition": "Ltd",
  Reissue: "RE",
  Remastered: "RM",
  Repress: "RP",
  Compilation: "Comp",
  "Mini-Album": "Mini",
  Numbered: "Num",
  Unofficial: "Unofficial",
  "Unofficial Release": "Unofficial",
  Enhanced: "Enh",
  "Special Edition": "S/Edition",
  "Test Pressing": "TP",
  "Club Edition": "Club",
  "Picture Disc": "Pic",
  "White Label": "W/Lbl",
};

export function mapFormat(formats) {
  if (!formats?.length) return undefined;
  return formats
    .map((format) => {
      const qty = Number(format.qty) > 1 ? `${Number(format.qty)}x` : "";
      const descriptions = (format.descriptions ?? []).map((text) => DESCRIPTION_ABBREVIATIONS[text] ?? text);
      return [`${qty}${format.name}`, ...descriptions, ...(format.text ? [format.text] : [])].join(", ");
    })
    .join(" + ");
}

export function mapCatalogNo(labels) {
  const catno = (labels ?? []).map((label) => label.catno?.trim()).find((value) => value && value.toLowerCase() !== "none");
  return catno || undefined;
}

export function primaryImage(images) {
  if (!images?.length) return null;
  const image = images.find((candidate) => candidate.type === "primary") ?? images[0];
  return { url: image.uri, width: image.width, height: image.height, primary: image.type === "primary" };
}

const sameTitles = (a, b) => a.length === b.length && a.every((track, index) => normalizeTitle(track.title) === normalizeTitle(b[index].title));

/**
 * @param {{ master?: Record<string, any> | null, release?: Record<string, any> | null, artistFilter?: (name: string) => boolean }} [input]
 */
// `release` is the release document, or the master's main release; `master` is set for master entries.
export function summarizeDiscogs({ master = null, release = null, artistFilter } = {}) {
  const releaseTracks = mapTracklist(release?.tracklist, { artistFilter });
  let tracks = releaseTracks;
  if (master?.tracklist?.length) {
    const masterTracks = mapTracklist(master.tracklist, { artistFilter });
    tracks = sameTitles(masterTracks, releaseTracks)
      ? masterTracks.map((track, index) => (track.duration || !releaseTracks[index].duration ? track : { ...track, duration: releaseTracks[index].duration }))
      : masterTracks;
  }
  const notes = release?.notes?.trim();
  // A master's images are sometimes all "secondary" (back, inlay); a primary on the main release wins over those.
  const images = [primaryImage(master?.images), primaryImage(release?.images)].filter(Boolean);
  return {
    releaseId: release?.id ?? null,
    catalogNo: mapCatalogNo(release?.labels),
    format: mapFormat(release?.formats),
    tracks,
    image: images.find((image) => image.primary) ?? images[0] ?? null,
    notes: notes || undefined,
  };
}
