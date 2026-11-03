// Pure parsing helpers for the 2013 legacy Oöphoi site (HTML 4.01, iso-8859-1).
// No file system access here so every function can be unit tested.

/** Legacy pages that hold release data, in the order they are migrated. */
export const SOURCE_PAGES = [
  { file: "albums1.html", layout: "release" },
  { file: "albums2.html", layout: "release" },
  { file: "albums3.html", layout: "release" },
  { file: "albums4.html", layout: "release" },
  { file: "minis.html", layout: "release" },
  { file: "compilations.html", layout: "compilation" },
  { file: "klauswiese.html", layout: "kw" },
];

/**
 * Informational only: duplicates and leftovers in the legacy folder, listed in the migration log.
 * They are never read because `SOURCE_PAGES` is the allowlist; this list filters nothing.
 */
export const KNOWN_SKIPPED_PAGES =["complete.htm", "eps.html", "albums5.html", "Copia de *", "test.htm", "void.htm"];

// ---------------------------------------------------------------------------
// Text decoding

/** Decodes legacy bytes as iso-8859-1. UTF-8 decoding would corrupt ö, é, ä. */
export function decodeLatin1(bytes) {
  // Not TextDecoder("latin1"): the WHATWG spec maps that label to windows-1252.
  return Buffer.from(bytes).toString("latin1");
}

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  sim: "∼",
  ouml: "ö",
  Ouml: "Ö",
  auml: "ä",
  uuml: "ü",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  ograve: "ò",
  igrave: "ì",
  ugrave: "ù",
};

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name) => {
    if (name[0] === "#") {
      const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[name] ?? match;
  });
}

const collapse = (text) => text.replace(/\s+/g, " ").trim();

/** Strips tags, decodes entities and collapses whitespace. */
export function htmlToText(html) {
  return collapse(decodeEntities(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ")))
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")");
}

// ---------------------------------------------------------------------------
// Hrefs

/** Removes the binary junk and stray question marks found in corrupted legacy hrefs. */
const sanitizeHref = (href) => href.replace(/[^\x21-\x7e]/g, "").replace(/\?/g, "");

/**
 * Extracts `{ kind, id }` from a Discogs master/release href, tolerating the
 * corruption patterns in the legacy files (binary bytes, `??????`, `ht?tp://`,
 * domain-less paths). Returns null for any other link.
 */
export function extractDiscogsRef(href) {
  if (!href) return null;
  const matches = [...sanitizeHref(href).matchAll(/(master|release)[^/]*\/(\d+)/g)];
  const last = matches.at(-1);
  if (!last) return null;
  const id = Number(last[2]);
  return id > 0 ? { kind: last[1], id } : null;
}

const safeDecodeURI = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const discogsPathName = (href, segment) => {
  if (!href) return null;
  // Query strings (e.g. `?anv=`) are dropped before sanitising, which also strips `?`.
  const match = new RegExp(`/${segment}/([^/?#"]+)`).exec(href.split("?anv=")[0]);
  if (!match) return null;
  const raw = sanitizeHref(match[1]);
  return raw ? raw : null;
};

const stripDisambiguator = (name) => name.replace(/\s*\(\d+\)$/, "");

/** Canonical Discogs artist name from an `/artist/<name>` href, without `(N)` disambiguators. */
export function artistNameFromHref(href) {
  const raw = discogsPathName(href, "artist");
  if (!raw) return null;
  return stripDisambiguator(collapse(safeDecodeURI(raw.replace(/\+/g, " "))));
}

// ---------------------------------------------------------------------------
// Titles

const FORMAT_TOKEN =
  /^(\d+x)?(CDr?|CDROM|CD-ROM|DVD|LP|EP|Album|Mini|Minialbum|Ltd|Comp|RE|RM|RP|Promo|Box|Single|Cle|\d+")$/i;

const isFormat = (text) =>
  text
    .split(",")
    .map((token) => token.trim())
    .every((token) => token.length > 0 && token.split("/").every((part) => FORMAT_TOKEN.test(part)));

/** Splits "A, B & C" into names. */
const splitNames = (text) =>
  text
    .split(/\s*(?:,|&|\band\b)\s*/)
    .map((name) => name.trim())
    .filter(Boolean);

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Parses legacy title text such as
 * `Genesis (as Nebula with Klaus Wiese, Tau Ceti) - (2 versions)` into
 * `{ title, alias?, with, format?, versions?, note? }`.
 */
export function parseTitleText(text) {
  const clean = collapse(text);
  const firstParen = clean.indexOf("(");
  const title = (firstParen === -1 ? clean : clean.slice(0, firstParen)).replace(/[\s-]+$/, "").trim();
  const result = { title, with: [] };
  const notes = [];

  for (const [, inner] of clean.matchAll(/\(([^()]*)\)/g)) {
    const group = inner.trim();
    let match;
    if ((match = /^(\d+)\s+versions?$/i.exec(group))) {
      result.versions = Number(match[1]);
    } else if (/\bbox\b/i.test(group)) {
      result.format = group;
    } else if ((match = /^as\s+(.+?)(?:\s+with\s+(.+))?$/i.exec(group))) {
      result.alias = match[1].trim();
      if (match[2]) result.with.push(...splitNames(match[2]));
    } else if ((match = /^with\s+(.+)$/i.exec(group))) {
      result.with.push(...splitNames(match[1]));
    } else if (isFormat(group)) {
      result.format = group
        .split(",")
        .map((token) => token.trim())
        .join(", ");
    } else if (group) {
      notes.push(capitalize(group));
    }
  }

  if (notes.length > 0) result.note = notes.join("; ");
  return orderKeys(result, ["title", "alias", "with", "format", "versions", "note"]);
}

const orderKeys = (object, keys) =>
  Object.fromEntries(keys.filter((key) => object[key] !== undefined).map((key) => [key, object[key]]));

// ---------------------------------------------------------------------------
// Labels

/** Normalises a label name; returns null when nothing meaningful is left. */
export function cleanLabelName(raw) {
  const name = stripDisambiguator(collapse(decodeEntities(raw)).replace(/^[\s,;]+|[\s,;]+$/g, ""));
  return name.length > 0 ? name : null;
}

/**
 * Turns legacy label links/text into a deduplicated `{ name, discogsUrl? }[]`.
 * The href (canonical Discogs name) wins over the visible link text.
 */
export function cleanLabels(entries) {
  const labels = [];
  const seen = new Set();
  for (const { text = "", href } of entries) {
    const path = discogsPathName(href, "label");
    const hrefName = path ? cleanLabelName(safeDecodeURI(path.replace(/\+/g, " "))) : null;
    const names = hrefName ? [hrefName] : text.split(",").map(cleanLabelName).filter(Boolean);
    for (const name of names) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      labels.push(path && hrefName ? { name, discogsUrl: `https://www.discogs.com/label/${path}` } : { name });
    }
  }
  return labels;
}

// ---------------------------------------------------------------------------
// Slugs

export function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// Table parsing

const attr = (tag, name) => new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i").exec(tag)?.[1];

const splitRows = (html) =>
  [...html.matchAll(/<tr\b([^>]*)>([\s\S]*?)(?=<tr\b|<\/table>|$)/gi)].map(([, attrs, body]) => ({
    hidden: /display\s*:\s*none/i.test(attrs),
    cells: [...body.matchAll(/<t[dh]\b([^>]*)>([\s\S]*?)(?=<t[dh]\b|<\/tr>|$)/gi)].map(([, cellAttrs, html]) => ({
      colspan: Number(attr(cellAttrs, "colspan") ?? 1),
      html,
    })),
  }));

const anchors = (html) =>
  [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(([whole, attrs, inner]) => ({
    whole,
    href: attr(attrs, "href"),
    text: htmlToText(inner),
  }));

const thumbOf = (html) => /<img\b[^>]*src\s*=\s*"([^"]*)"/i.exec(html)?.[1];

const yearOf = (text) => {
  const match = /\b(19|20)\d{2}\b/.exec(text);
  return match ? Number(match[0]) : undefined;
};

const snippet = (row) => htmlToText(row.cells.map((cell) => cell.html).join(" | ")).slice(0, 160);

/** Maps visible collaborator text (e.g. "K. Wiese") to canonical Discogs artist names. */
const canonicalNames = (names, cellAnchors) => {
  const byText = new Map();
  for (const anchor of cellAnchors) {
    const canonical = artistNameFromHref(anchor.href);
    if (canonical) byText.set(anchor.text.replace(/[()]/g, "").trim().toLowerCase(), canonical);
  }
  return names.map((name) => byText.get(name.toLowerCase()) ?? name);
};

/** The title anchor's ref, falling back to the thumbnail's (some title hrefs are damaged). */
const refFor = (titleAnchor, thumbAnchor) =>
  extractDiscogsRef(titleAnchor?.href) ?? extractDiscogsRef(thumbAnchor?.href);

const linkedRefsIn = (cellAnchors, ownRef) =>
  cellAnchors
    .map((anchor) => extractDiscogsRef(anchor.href))
    .filter((ref) => ref && !(ref.kind === ownRef.kind && ref.id === ownRef.id));

const hasThumb = (row) => row.cells.some((cell) => /<img\b/i.test(cell.html));

function parseReleaseRow(row, file) {
  const [thumbCell, titleCell, labelCell, yearCell] = row.cells;
  const titleAnchors = anchors(titleCell.html);
  const ref = refFor(titleAnchors[0], anchors(thumbCell.html)[0]);
  if (!ref) return { error: "no Discogs master/release id found" };
  const parsed = parseTitleText(htmlToText(titleCell.html));
  const year = yearOf(htmlToText(yearCell?.html ?? ""));
  if (!parsed.title) return { error: "empty title" };
  if (!year) return { error: "no year found" };
  const labelAnchors = anchors(labelCell?.html ?? "");
  const labels = cleanLabels(labelAnchors.length > 0 ? labelAnchors : [{ text: htmlToText(labelCell?.html ?? "") }]);
  return {
    row: buildRow({
      source: file,
      title: parsed.title,
      year,
      format: parsed.format,
      labels,
      credit: { alias: parsed.alias, with: canonicalNames(parsed.with, titleAnchors) },
      discogs: { ...ref, versions: parsed.versions },
      thumb: thumbOf(thumbCell.html),
      note: parsed.note,
      linkedRefs: linkedRefsIn(titleAnchors.slice(1), ref),
      hidden: row.hidden,
    }),
  };
}

function parseKwRow(row, file) {
  const [catalogCell, titleCell, yearCell] = row.cells;
  const catalogNo = htmlToText(catalogCell.html);
  if (!/^KW\s*\d+$/i.test(catalogNo)) return { error: "no KW catalogue number" };
  const titleAnchors = anchors(titleCell.html);
  const ref = extractDiscogsRef(titleAnchors[0]?.href);
  if (!ref) return { error: "no Discogs master/release id found" };
  const parsed = parseTitleText(htmlToText(titleCell.html));
  const year = yearOf(htmlToText(yearCell?.html ?? ""));
  if (!year) return { error: "no year found" };
  return {
    row: buildRow({
      source: file,
      title: parsed.title,
      year,
      catalogNo: catalogNo.replace(/^KW\s*/i, "KW "),
      format: parsed.format,
      labels: [],
      credit: { alias: parsed.alias, with: canonicalNames(parsed.with, titleAnchors) },
      discogs: { ...ref, versions: parsed.versions },
      note: parsed.note,
      linkedRefs: [],
      hidden: row.hidden,
    }),
  };
}

function parseCompilationRow(row, file) {
  const [thumbCell, infoCell, tracksCell, durationsCell] = row.cells;
  const infoAnchors = anchors(infoCell.html);
  const titleAnchor = infoAnchors[0];
  const ref = refFor(titleAnchor, anchors(thumbCell.html)[0]);
  if (!ref) return { error: "no Discogs master/release id found" };
  const labelAnchors = infoAnchors.filter((anchor) => /\/label\//.test(anchor.href ?? ""));
  let rest = infoCell.html;
  for (const anchor of [titleAnchor, ...labelAnchors]) rest = rest.replace(anchor.whole, " ");
  const restText = htmlToText(rest);
  const year = yearOf(restText);
  if (!year) return { error: "no year found" };
  const format = /\(([^()]*)\)/.exec(restText)?.[1]?.trim();

  const lines = (html) => (html ?? "").split(/<br\s*\/?>/i).map(htmlToText).filter(Boolean);
  const durations = lines(durationsCell?.html);
  const tracks = lines(tracksCell?.html).map((line, index) => {
    const track = parseTitleText(line);
    return orderKeys(
      { title: track.title, duration: durations[index], with: track.with.length > 0 ? track.with : undefined },
      ["title", "duration", "with"],
    );
  });

  return {
    row: buildRow({
      source: file,
      title: titleAnchor.text,
      year,
      format,
      labels: cleanLabels(labelAnchors),
      credit: { with: [] },
      discogs: ref,
      thumb: thumbOf(thumbCell.html),
      tracks,
      linkedRefs: [],
      hidden: row.hidden,
    }),
  };
}

const ROW_KEYS = [
  "source",
  "title",
  "year",
  "catalogNo",
  "format",
  "labels",
  "credit",
  "discogs",
  "thumb",
  "tracks",
  "note",
  "linkedRefs",
  "hidden",
];

const buildRow = (row) =>
  orderKeys(
    {
      ...row,
      credit: orderKeys(row.credit, ["alias", "with"]),
      discogs: orderKeys(row.discogs, ["kind", "id", "versions"]),
    },
    ROW_KEYS,
  );

/** The compilation page puts the "taken from…" note in the row after each release. */
const applyCompilationNote = (release, row) => {
  const noteCell = row.cells.at(-1);
  const text = htmlToText(noteCell?.html ?? "").replace(/^-\s*/, "");
  if (!text) return;
  release.note = capitalize(text);
  const refs = anchors(noteCell.html)
    .map((anchor) => extractDiscogsRef(anchor.href))
    .filter(Boolean);
  release.linkedRefs = refs;
};

/**
 * Parses one legacy page.
 * @param {string} html decoded page source
 * @param {{ file: string, layout: "release" | "compilation" | "kw" }} page
 * @returns {{ rows: object[], unparsed: { source: string, reason: string, snippet: string }[] }}
 */
export function parseLegacyPage(html, { file, layout }) {
  const rows = [];
  const unparsed = [];
  const expectedCells = layout === "kw" ? 3 : 4;

  for (const row of splitRows(html)) {
    const isDataRow = row.cells.length === expectedCells && row.cells.every((cell) => cell.colspan === 1);
    if (!isDataRow) {
      // On the compilation page, a note row (with a colspan="2" cell) follows each release;
      // only the first one per release is used.
      const last = rows.at(-1);
      const isNoteRow = row.cells.some((cell) => cell.colspan === 2) && !hasThumb(row);
      if (layout === "compilation" && last && last.note === undefined && isNoteRow) applyCompilationNote(last, row);
      continue;
    }
    if (row.cells.every((cell) => htmlToText(cell.html) === "")) continue;

    const parse = layout === "kw" ? parseKwRow : layout === "compilation" ? parseCompilationRow : parseReleaseRow;
    const result = parse(row, file);
    if (result.row) rows.push(result.row);
    else unparsed.push({ source: file, reason: result.error, snippet: snippet(row) });
  }

  return { rows, unparsed };
}

// ---------------------------------------------------------------------------
// Release entries

const typeFor = (row) => {
  if (row.source === "klauswiese.html") return "kw-remaster";
  if (row.source === "compilations.html") return "compilation-appearance";
  if (/\bbox\b/i.test(row.format ?? "")) return "box";
  if (row.source === "minis.html") return /\bmini/i.test(row.format ?? "") ? "minialbum" : "ep";
  return "album";
};

const refKey = (ref) => `${ref.kind}/${ref.id}`;

const RELEASE_KEYS = [
  "title",
  "slug",
  "type",
  "artist",
  "year",
  "labels",
  "catalogNo",
  "format",
  "credit",
  "discogs",
  "tracks",
  "note",
  "relatedTo",
  "hidden",
];

/**
 * Pairs each row with a unique, deterministic slug: `title`, then `title-year`
 * (never for hidden rows), then `title-discogsId`.
 */
function assignSlugs(rows) {
  const used = new Set();
  const yearsByBase = new Map();
  return rows.map((row) => {
    const base = slugify(row.title);
    const years = yearsByBase.get(base) ?? new Set();
    const yearSlug = row.hidden || years.has(row.year) ? null : `${base}-${row.year}`;
    const candidates = [base, yearSlug, `${base}-${row.discogs.id}`];
    const slug = candidates.find((candidate) => candidate && !used.has(candidate)) ?? `${base}-${row.discogs.kind}-${row.discogs.id}`;
    used.add(slug);
    years.add(row.year);
    yearsByBase.set(base, years);
    return { row, slug };
  });
}

/** Maps `keyOf(row)` to the slug of the first visible row with that key; rows without a key are skipped. */
function firstVisibleSlugBy(slugged, keyOf) {
  const slugs = new Map();
  for (const { row, slug } of slugged) {
    const key = keyOf(row);
    if (key && !row.hidden && !slugs.has(key)) slugs.set(key, slug);
  }
  return slugs;
}

/** Some label hrefs are damaged beyond repair; reuse the URL seen for the same label elsewhere. */
function labelUrlRepairer(rows) {
  const labelUrls = new Map();
  for (const row of rows) {
    for (const label of row.labels) if (label.discogsUrl && !labelUrls.has(label.name)) labelUrls.set(label.name, label.discogsUrl);
  }
  return (label) => (label.discogsUrl || !labelUrls.has(label.name) ? label : { ...label, discogsUrl: labelUrls.get(label.name) });
}

/** Related slugs: linked Discogs references, plus the visible KW release a hidden version belongs to. */
function relatedSlugsFor({ row, slug }, slugByRef, visibleKwByCatalog) {
  const related = new Set(row.linkedRefs.map((ref) => slugByRef.get(refKey(ref))).filter(Boolean));
  if (row.hidden && row.catalogNo && visibleKwByCatalog.has(row.catalogNo)) related.add(visibleKwByCatalog.get(row.catalogNo));
  related.delete(slug);
  return related;
}

/**
 * Converts parsed rows into release entries with unique, deterministic slugs
 * (`title`, then `title-year`, then `title-discogsId`) and related-release links.
 * The `thumb` path is kept so the caller can copy the cover.
 */
export function buildReleases(rows) {
  const slugged = assignSlugs(rows);
  const slugByRef = firstVisibleSlugBy(slugged, (row) => refKey(row.discogs));
  const visibleKwByCatalog = firstVisibleSlugBy(slugged, (row) => row.catalogNo);
  const withLabelUrl = labelUrlRepairer(rows);

  return slugged.map(({ row, slug }) => {
    const related = relatedSlugsFor({ row, slug }, slugByRef, visibleKwByCatalog);
    const type = typeFor(row);
    const entry = orderKeys(
      {
        title: row.title,
        slug,
        type,
        artist: type === "kw-remaster" ? "Klaus Wiese" : undefined,
        year: row.year,
        labels: row.labels.map(withLabelUrl),
        catalogNo: row.catalogNo,
        format: row.format,
        credit: row.credit,
        discogs: row.discogs,
        tracks: row.tracks,
        note: row.note,
        relatedTo: related.size > 0 ? [...related] : undefined,
        hidden: row.hidden,
      },
      RELEASE_KEYS,
    );
    return Object.defineProperty(entry, "thumb", { value: row.thumb, enumerable: false });
  });
}
