// Human-readable summary of proposals.json (docs/enrichment-report.md).

const SOURCE_NAMES = { bandcamp: "Bandcamp", databloem: "Databloem", discogs: "Discogs" };
const NOTE_PREVIEW = 100;

const longestSide = (size) => Math.max(size.width, size.height);
const size = (value) => `${value.width}×${value.height}`;
const code = (value) => `\`${String(value).replace(/`/g, "'")}\``;
const listOrValue = (value) => (Array.isArray(value) ? value.join("; ") : value);

const hasChanges = (proposal) =>
  Boolean(proposal.cover) ||
  Object.keys(proposal.fills).length > 0 ||
  proposal.conflicts.length > 0 ||
  proposal.disagreements.length > 0 ||
  Boolean(proposal.note);

/** @param {any[]} proposals */
export function computeTotals(proposals) {
  const covers = proposals.filter((proposal) => proposal.cover).map((proposal) => proposal.cover);
  const replacing = covers.filter((cover) => cover.current);
  /** @type {Record<string, number>} */
  const bySource = {};
  for (const cover of covers) bySource[cover.source] = (bySource[cover.source] ?? 0) + 1;
  const count = (predicate) => proposals.filter(predicate).length;
  return {
    releases: proposals.length,
    withChanges: count(hasChanges),
    covers: {
      total: covers.length,
      bySource,
      replacing: replacing.length,
      new: covers.length - replacing.length,
      averageGain: replacing.length ? replacing.reduce((sum, cover) => sum + longestSide(cover) / longestSide(cover.current), 0) / replacing.length : null,
      averageLongestSide: covers.length ? Math.round(covers.reduce((sum, cover) => sum + longestSide(cover), 0) / covers.length) : null,
    },
    tracklists: count((proposal) => proposal.fills.tracks),
    trackDurations: count((proposal) => proposal.fills.trackDurations),
    catalogNo: count((proposal) => proposal.fills.catalogNo),
    format: count((proposal) => proposal.fills.format),
    conflicts: proposals.reduce((sum, proposal) => sum + proposal.conflicts.length, 0),
    releasesWithConflicts: count((proposal) => proposal.conflicts.length > 0),
    disagreements: proposals.reduce((sum, proposal) => sum + proposal.disagreements.length, 0),
    notes: count((proposal) => proposal.note),
  };
}

function releaseSection(proposal) {
  const lines = [`### ${proposal.slug}: ${proposal.title} (${proposal.year})`, ""];
  if (proposal.matches?.length) {
    lines.push(`- Matched: ${proposal.matches.map((match) => `${SOURCE_NAMES[match.source]} ${code(match.id)} (${match.kind})`).join(", ")}`);
  }
  if (proposal.cover) {
    const current = proposal.cover.current ? `current ${size(proposal.cover.current)}` : "no current cover";
    lines.push(`- Cover: ${SOURCE_NAMES[proposal.cover.source]} ${size(proposal.cover)} (${current})`);
  }
  const { tracks, trackDurations, ...scalars } = proposal.fills;
  if (tracks) {
    const timed = tracks.value.filter((track) => track.duration).length;
    lines.push(`- Fill tracks: ${tracks.value.length} tracks, ${timed} with duration (${tracks.source})`);
  }
  if (trackDurations) lines.push(`- Fill durations of ${trackDurations.length} existing track(s) (${trackDurations[0].source})`);
  for (const [field, fill] of Object.entries(scalars)) lines.push(`- Fill ${field}: ${code(fill.value)} (${fill.source})`);
  for (const conflict of proposal.conflicts) {
    const sources = Object.entries(conflict.sources).map(([source, value]) => `${source} ${code(listOrValue(value))}`);
    lines.push(`- Conflict ${conflict.field}: current ${code(listOrValue(conflict.current))}; ${sources.join("; ")}`);
  }
  for (const disagreement of proposal.disagreements) {
    const sources = Object.entries(disagreement.sources).map(([source, value]) => `${source} ${code(listOrValue(value))}`);
    lines.push(`- Sources disagree on ${disagreement.field} (Discogs kept): ${sources.join("; ")}`);
  }
  if (proposal.note) {
    const text = proposal.note.text.replace(/\s+/g, " ");
    const preview = text.length > NOTE_PREVIEW ? `${text.slice(0, NOTE_PREVIEW)}…` : text;
    lines.push(`- Note proposal (${proposal.note.source}, ${proposal.note.text.length} chars): "${preview}"`);
  }
  if (proposal.otherEditions?.length) {
    lines.push(`- Other editions: ${proposal.otherEditions.map((edition) => `${SOURCE_NAMES[edition.source]} ${code(edition.catalogNo)}${edition.year ? ` (${edition.year})` : ""}`).join(", ")}`);
  }
  return lines.join("\n");
}

const itemLabel = (item) => `${SOURCE_NAMES[item.source]} ${code(item.id)} "${item.title}"${item.credit ? ` by ${item.credit}` : ""}`;

/**
 * @param {{ proposals: any[], unmatched: any[], ambiguous: any[], generatedAt: string, failures?: string[] }} input
 */
export function renderReport({ proposals, unmatched, ambiguous, generatedAt, failures = [] }) {
  const totals = computeTotals(proposals);
  const changed = proposals.filter(hasChanges);
  const percent = (value) => (value === null ? "n/a" : `${value.toFixed(1)}×`);
  const out = [
    "# Release enrichment report",
    "",
    `Generated ${generatedAt} by \`pnpm enrich\`. Nothing has been written to the release files: review this report, then run`,
    "`node scripts/enrich-releases.mjs --apply [--only slug1,slug2]` to copy the proposed covers and fill the empty fields.",
    "Conflicts and note proposals are never applied; settle them by hand. Full data: `.cache/enrich/proposals.json`.",
    "",
    `## Releases (${changed.length} of ${proposals.length} with proposals)`,
    "",
    ...changed.flatMap((proposal) => [releaseSection(proposal), ""]),
    `## Ambiguous (${ambiguous.length})`,
    "",
    "Matched more than one release, or only partially. Nothing is proposed from these items.",
    "",
    ...(ambiguous.length ? ambiguous.map((entry) => `- ${itemLabel(entry.item)}: ${entry.reason}; candidates: ${entry.candidates.join(", ")}`) : ["None."]),
    "",
    `## Unmatched (${unmatched.length})`,
    "",
    ...(unmatched.length
      ? unmatched.map((entry) => `- ${itemLabel(entry.item)}${entry.suggestions.length ? `; similar: ${entry.suggestions.join(", ")}` : ""}`)
      : ["None."]),
    "",
  ];
  if (failures.length) {
    out.push(`## Fetch failures (${failures.length})`, "", ...failures.map((failure) => `- ${failure}`), "");
  }
  out.push(
    "## Totals",
    "",
    `- Proposed covers: ${totals.covers.total} (${Object.entries(totals.covers.bySource).map(([source, count]) => `${SOURCE_NAMES[source]} ${count}`).join(", ") || "none"}); ${totals.covers.replacing} replace an existing cover, ${totals.covers.new} are new`,
    `- Average resolution gain over the replaced covers (longest side): ${percent(totals.covers.averageGain)}; average longest side of proposed covers: ${totals.covers.averageLongestSide ?? "n/a"} px`,
    `- Tracklists to fill: ${totals.tracklists}; releases with track durations to fill: ${totals.trackDurations}`,
    `- catalogNo to fill: ${totals.catalogNo}; format to fill: ${totals.format}`,
    `- Conflicts: ${totals.conflicts} in ${totals.releasesWithConflicts} releases; source disagreements: ${totals.disagreements}; note proposals: ${totals.notes}`,
    `- Ambiguous items: ${ambiguous.length}; unmatched items: ${unmatched.length}`,
    "",
  );
  return out.join("\n");
}
