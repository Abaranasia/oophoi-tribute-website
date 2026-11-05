// Title normalization shared by the matchers, so "Oöphoi – Dreams part one" and "Dreams Part One" compare equal.

const NAMED_ENTITIES = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lrm: "‎",
  rlm: "‏",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  aelig: "æ",
  AElig: "Æ",
  oslash: "ø",
  szlig: "ß",
  ouml: "ö",
  Ouml: "Ö",
  auml: "ä",
  Auml: "Ä",
  uuml: "ü",
  Uuml: "Ü",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  aacute: "á",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ccedil: "ç",
  ntilde: "ñ",
};

export function decodeEntities(text) {
  return String(text).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, name) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return Object.hasOwn(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : match;
  });
}

const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };
// "(2 CD)", "(2cd)", "(Remastered)": edition details that are not part of the title.
const EDITION_QUALIFIER = /[([]\s*(?:\d+\s*x?\s*cdr?s?|cdr?|lp|remaster(?:ed)?|reissue|digital|deluxe(?: edition)?)\s*[)\]]/gi;
const OOPHOI_PREFIX = /^\s*oophoi\s*[-–—:]\s*/;

function fold(text) {
  return decodeEntities(text)
    .replace(/[‎‏]/g, "")
    .replace(/æ/gi, "ae")
    .replace(/ø/gi, "o")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function normalizeTitle(text) {
  return fold(text)
    .replace(OOPHOI_PREFIX, "")
    .replace(EDITION_QUALIFIER, " ")
    .replace(/&/g, " and ")
    .replace(/\b(?:volume|vol)\b\.?/g, " vol ")
    .replace(/\b(?:part|pt)\b\.?/g, " part ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(vol|part) ([a-z]+)\b/g, (match, kind, word) => {
      const number = NUMBER_WORDS[word] ?? ROMAN[word];
      return number ? `${kind} ${number}` : match;
    })
    .trim()
    .replace(/\s+/g, " ");
}

// Databloem titles read "Artist - title", "Artist : title" or "Artist ‎– title".
export function splitCredit(rawTitle) {
  const text = decodeEntities(rawTitle).replace(/[‎‏]/g, "").replace(/\s+/g, " ").trim();
  const separator = text.match(/\s[-–—:]\s/);
  if (!separator) return { credit: null, title: text };
  return {
    credit: text.slice(0, separator.index).trim(),
    title: text.slice(separator.index + separator[0].length).trim(),
  };
}

export function isOophoiCredit(credit, aliases = []) {
  if (!credit) return false;
  const folded = fold(credit);
  return ["oophoi", "ooephoi", ...aliases.map(fold)].some((name) => folded.includes(name));
}

export function titleKeys(title) {
  const decoded = decodeEntities(title);
  const full = normalizeTitle(decoded);
  const colon = decoded.indexOf(":");
  const dash = decoded.search(/\s[-–—]\s/);
  const subtitle = colon > 0 ? normalizeTitle(decoded.slice(colon + 1)) || null : null;
  const cuts = [colon, dash].filter((index) => index > 0);
  const head = cuts.length > 0 ? normalizeTitle(decoded.slice(0, Math.min(...cuts))) || null : null;
  const series = full.match(/^(.*?\b(?:vol|part) \d+)\b/)?.[1] ?? null;
  return { full, subtitle, head, series };
}

export function tokenSimilarity(a, b) {
  const left = new Set(normalizeTitle(a).split(" ").filter(Boolean));
  const right = new Set(normalizeTitle(b).split(" ").filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared++;
  return shared / (left.size + right.size - shared);
}
