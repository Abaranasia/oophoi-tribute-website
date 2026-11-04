// --apply: writes the fill-only part of a proposal into a release object. Conflicts and the proposed note
// are never applied, and a field that was hand-edited after the proposal was made is left alone.
import { normalizeTitle } from "./normalize.mjs";

// Key order of the schema in src/content.config.ts, which the release files follow.
const KEY_ORDER = ["title", "slug", "type", "artist", "year", "labels", "catalogNo", "format", "credit", "discogs", "cover", "tracks", "note", "relatedTo", "hidden"];
const FILLABLE = ["catalogNo", "format", "tracks"];

function inSchemaOrder(release) {
  const ordered = {};
  for (const key of KEY_ORDER) if (release[key] !== undefined) ordered[key] = release[key];
  for (const key of Object.keys(release)) if (!(key in ordered) && release[key] !== undefined) ordered[key] = release[key];
  return ordered;
}

const isEmpty = (value) => value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

/**
 * @param {Record<string, any>} release
 * @param {Record<string, any>} proposal
 * @param {{ coverRef: string }} options
 * @returns {{ release: Record<string, any>, applied: string[], skipped: string[] }}
 */
export function applyProposal(release, proposal, { coverRef }) {
  const next = structuredClone(release);
  const applied = [];
  const skipped = [];

  if (proposal.cover) {
    next.cover = coverRef;
    applied.push("cover");
  }

  for (const field of FILLABLE) {
    const fill = proposal.fills?.[field];
    if (!fill) continue;
    if (!isEmpty(next[field])) {
      skipped.push(`${field} (no longer empty)`);
      continue;
    }
    next[field] = structuredClone(fill.value);
    applied.push(field);
  }

  for (const { index, title, duration } of proposal.fills?.trackDurations ?? []) {
    const track = next.tracks?.[index];
    if (!track || normalizeTitle(track.title) !== normalizeTitle(title)) skipped.push(`tracks[${index}].duration (track changed)`);
    else if (track.duration) skipped.push(`tracks[${index}].duration (no longer empty)`);
    else {
      track.duration = duration;
      applied.push(`tracks[${index}].duration`);
    }
  }

  return { release: inSchemaOrder(next), applied, skipped };
}

/**
 * @param {string[]} argv CLI arguments after the script path.
 * @returns {{ apply: boolean, only: string[] | null }}
 */
export function parseEnrichArgs(argv) {
  /** @type {{ apply: boolean, only: string[] | null }} */
  const options = { apply: false, only: null };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--apply") options.apply = true;
    else if (arg === "--only" || arg.startsWith("--only=")) {
      const value = arg === "--only" ? argv[++index] : arg.slice("--only=".length);
      if (!value || value.startsWith("--")) throw new Error("--only needs a comma-separated list of slugs");
      options.only = value.split(",").map((slug) => slug.trim()).filter(Boolean);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.only && !options.apply) throw new Error("--only requires --apply");
  return options;
}
