// Turns the source data of one release into a proposal. Hand-edited values always win: only empty fields
// are filled, and a differing value becomes a conflict for a human to settle. title, slug, type, year,
// hidden, relatedTo and credit are never proposed; the note is proposed for reading, never filled.
//
// Discogs describes the exact edition a release file points at, so it is the only source for catalogNo
// and format. Bandcamp and Databloem sell later reissues (other labels, catalog numbers, sometimes other
// track titles): their tracks are used only when they line up with Discogs or Discogs has none, and the
// Databloem reference is listed as another edition.
import { formatDuration } from "./discogs.mjs";
import { normalizeTitle } from "./normalize.mjs";

const DURATION_TOLERANCE_SECONDS = 2;

const compact = (value) => normalizeTitle(value).replace(/ /g, "");
const toSeconds = (duration) => duration.split(":").reduce((total, part) => total * 60 + Number(part), 0);
const sameDuration = (a, b) => Math.abs(toSeconds(a) - toSeconds(b)) <= DURATION_TOLERANCE_SECONDS;
const sameTitles = (a, b) => a.length === b.length && a.every((track, index) => normalizeTitle(track.title) === normalizeTitle(b[index].title));
const describeTracks = (tracks) => tracks.map((track) => (track.duration ? `${track.title} (${track.duration})` : track.title));

function bandcampTracks(albums) {
  const album = albums.find((candidate) => candidate.tracks?.length);
  if (!album) return [];
  return album.tracks.map((track) => {
    const duration = formatDuration(track.seconds);
    return duration ? { title: track.title, duration } : { title: track.title };
  });
}

function proposeScalar(proposal, release, field, discogsValue) {
  if (!discogsValue) return;
  const current = release[field];
  if (!current) proposal.fills[field] = { value: discogsValue, source: "discogs" };
  else if (compact(current) !== compact(discogsValue)) proposal.conflicts.push({ field, current, sources: { discogs: discogsValue } });
}

function proposeNewTracks(proposal, discogsList, bandcampList) {
  if (discogsList.length > 0) {
    if (bandcampList.length > 0 && sameTitles(discogsList, bandcampList)) {
      const completed = discogsList.map((track, index) => (track.duration || !bandcampList[index].duration ? track : { ...track, duration: bandcampList[index].duration }));
      const gained = completed.some((track, index) => track.duration !== discogsList[index].duration);
      proposal.fills.tracks = { value: completed, source: gained ? "discogs + bandcamp durations" : "discogs" };
      return;
    }
    proposal.fills.tracks = { value: discogsList, source: "discogs" };
    if (bandcampList.length > 0) {
      proposal.disagreements.push({ field: "tracks", sources: { discogs: describeTracks(discogsList), bandcamp: describeTracks(bandcampList) } });
    }
    return;
  }
  if (bandcampList.length > 0) proposal.fills.tracks = { value: bandcampList, source: "bandcamp" };
}

function proposeExistingTracks(proposal, current, [source, list]) {
  if (!sameTitles(current, list)) {
    proposal.conflicts.push({ field: "tracks", current: describeTracks(current), sources: { [source]: describeTracks(list) } });
    return;
  }
  const durations = [];
  current.forEach((track, index) => {
    const offered = list[index].duration;
    if (!offered) return;
    if (!track.duration) durations.push({ index, title: track.title, duration: offered, source });
    else if (!sameDuration(track.duration, offered)) {
      proposal.conflicts.push({ field: `tracks[${index}].duration`, current: track.duration, sources: { [source]: offered } });
    }
  });
  if (durations.length > 0) proposal.fills.trackDurations = durations;
}

/**
 * @typedef {{ slug: string, title: string, year: number, fills: Record<string, any>, conflicts: any[], disagreements: any[],
 *   otherEditions: any[], note?: { source: string, text: string } }} Proposal
 */

/**
 * @param {{ release: Record<string, any>, discogs: Record<string, any> | null, bandcamp?: any[], databloem?: any[] }} input
 * @returns {Proposal}
 */
export function buildProposal({ release, discogs, bandcamp = [], databloem = [] }) {
  /** @type {Proposal} */
  const proposal = {
    slug: release.slug,
    title: release.title,
    year: release.year,
    fills: {},
    conflicts: [],
    disagreements: [],
    otherEditions: databloem
      .filter((product) => product.reference)
      .map((product) => ({ source: "databloem", id: product.id, catalogNo: product.reference, year: product.year ?? null })),
  };

  proposeScalar(proposal, release, "catalogNo", discogs?.catalogNo);
  proposeScalar(proposal, release, "format", discogs?.format);

  // A compilation file lists Oophoi's own tracks only; a Bandcamp album is never that compilation.
  const discogsList = discogs?.tracks ?? [];
  const bandcampList = release.type === "compilation-appearance" ? [] : bandcampTracks(bandcamp);
  if (!release.tracks?.length) proposeNewTracks(proposal, discogsList, bandcampList);
  else {
    const reference = discogsList.length > 0 ? ["discogs", discogsList] : bandcampList.length > 0 ? ["bandcamp", bandcampList] : null;
    if (reference) proposeExistingTracks(proposal, release.tracks, reference);
  }

  if (!release.note && discogs?.notes) proposal.note = { source: "discogs", text: discogs.notes };
  return proposal;
}
