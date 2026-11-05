// One-off enrichment of the hand-edited release files with better covers and data from Discogs, Bandcamp
// and the Databloem shop. It produces a proposal for review; it never overwrites hand-edited values.
//
// Usage:
//   node scripts/enrich-releases.mjs                              (pnpm enrich) fetch, match, and write
//        .cache/enrich/proposals.json and docs/enrichment-report.md; nothing in src/ changes
//   node scripts/enrich-releases.mjs --apply [--only slug1,slug2] copy the proposed covers to src/assets/covers/
//        and fill the empty fields; conflicts and note proposals are never applied
//
// Every HTTP response and image is cached under .cache/enrich/ (gitignored), so re-runs do not refetch;
// delete that directory to start over. Pure logic lives in scripts/lib/enrich/ and is unit tested.
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { promisify } from "node:util";
import { applyProposal, parseEnrichArgs } from "./lib/enrich/apply.mjs";
import { BANDCAMP_BASE, parseAlbumLinks, parseAlbumPage } from "./lib/enrich/bandcamp.mjs";
import { COVER_PRIORITY, selectCover } from "./lib/enrich/cover.mjs";
import { DATABLOEM_SEARCH, parseProductPage, parseSearchResults } from "./lib/enrich/databloem.mjs";
import { DISCOGS_API, summarizeDiscogs } from "./lib/enrich/discogs.mjs";
import { cacheKey, createFetcher, USER_AGENT } from "./lib/enrich/http.mjs";
import { extensionFor, imageSize } from "./lib/enrich/image-size.mjs";
import { matchAll } from "./lib/enrich/match.mjs";
import { buildProposal } from "./lib/enrich/merge.mjs";
import { isOophoiCredit } from "./lib/enrich/normalize.mjs";
import { renderReport } from "./lib/enrich/report.mjs";

const releasesDir = resolve("src/content/releases");
const coversDir = resolve("src/assets/covers");
const cacheDir = resolve(".cache/enrich");
const candidatesDir = join(cacheDir, "covers");
const proposalsFile = join(cacheDir, "proposals.json");
const reportFile = resolve("docs/enrichment-report.md");
// Relative to a file in src/content/releases, as Astro's image() expects.
const coverRef = (file) => `../../assets/covers/${file}`;
const repoPath = (path) => relative(resolve("."), path).replace(/\\/g, "/");

let args;
try {
  args = parseEnrichArgs(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

async function loadReleases() {
  const files = (await readdir(releasesDir)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(
    files.map(async (file) => {
      const path = join(releasesDir, file);
      return { path, data: JSON.parse(await readFile(path, "utf8")) };
    }),
  );
}

async function sizeOf(path) {
  return existsSync(path) ? imageSize(await readFile(path)) : null;
}

// Bandcamp's CDN rejects some TLS clients with 403; PowerShell's stack is accepted. Node's fetch worked when
// this was written, so this only runs if that changes.
const execFileAsync = promisify(execFile);
async function powershellFetch(url) {
  const tmp = join(cacheDir, "tmp", `${cacheKey(url)}.download`);
  await mkdir(join(cacheDir, "tmp"), { recursive: true });
  const quote = (value) => `'${value.replace(/'/g, "''")}'`;
  await execFileAsync("powershell", [
    "-NoProfile",
    "-Command",
    `Invoke-WebRequest -UseBasicParsing -Uri ${quote(url)} -UserAgent ${quote(USER_AGENT)} -OutFile ${quote(tmp)}`,
  ]);
  const body = await readFile(tmp);
  await rm(tmp, { force: true });
  return body;
}

// ---------------------------------------------------------------------------
// Fetch mode

async function runFetch() {
  const failures = [];
  const fetcher = createFetcher({
    cacheDir,
    minIntervalMs: { "api.discogs.com": 2500, "i.discogs.com": 1000, "oophoi.bandcamp.com": 1000, "f4.bcbits.com": 500, "databloem.com": 1000 },
    fallback: async (url) => {
      const { hostname } = new URL(url);
      if (!/(^|\.)bandcamp\.com$|(^|\.)bcbits\.com$/.test(hostname)) throw new Error(`HTTP 403 for ${url}`);
      return powershellFetch(url);
    },
  });
  const text = async (url) => {
    const result = await fetcher.getText(url);
    if (result.status !== 200) throw new Error(`HTTP ${result.status} for ${url}`);
    return result.body;
  };

  const releases = await loadReleases();
  const releaseData = releases.map((release) => release.data);
  console.log(`${releases.length} release files`);

  // Bandcamp
  const albums = [];
  const albumSlugs = parseAlbumLinks(await text(`${BANDCAMP_BASE}/music`));
  console.log(`Bandcamp: ${albumSlugs.length} albums`);
  for (const slug of albumSlugs) {
    const url = `${BANDCAMP_BASE}/album/${slug}`;
    try {
      albums.push(parseAlbumPage(await text(url), url));
    } catch (error) {
      failures.push(`Bandcamp ${slug}: ${error.message}`);
    }
  }

  // Databloem
  const products = [];
  const productUrls = parseSearchResults(await text(DATABLOEM_SEARCH));
  console.log(`Databloem: ${productUrls.length} products`);
  for (const url of productUrls) {
    try {
      products.push(parseProductPage(await text(url), url));
    } catch (error) {
      failures.push(`Databloem ${url}: ${error.message}`);
    }
  }

  // Matching
  const items = [
    ...albums.map((album) => ({ source: "bandcamp", id: album.slug, title: album.title, year: album.year, url: album.url, data: album })),
    ...products.map((product) => ({
      source: "databloem",
      id: product.id,
      title: product.title,
      credit: product.credit,
      year: product.year,
      catalogNo: product.reference,
      url: product.url,
      data: product,
    })),
  ];
  const matching = matchAll(items, releaseData);
  const matchesBySlug = new Map();
  for (const match of matching.matched) {
    if (!matchesBySlug.has(match.slug)) matchesBySlug.set(match.slug, []);
    matchesBySlug.get(match.slug).push(match);
  }
  console.log(`Matched ${matching.matched.length}, ambiguous ${matching.ambiguous.length}, unmatched ${matching.unmatched.length}`);

  // Discogs, cover candidates and proposals, one release at a time
  const proposals = [];
  await mkdir(candidatesDir, { recursive: true });
  for (const [index, { path, data: release }] of releases.entries()) {
    console.log(`[${index + 1}/${releases.length}] ${release.slug}`);
    const matches = matchesBySlug.get(release.slug) ?? [];
    const bandcamp = matches.filter((match) => match.item.source === "bandcamp").map((match) => match.item.data);
    const databloem = matches.filter((match) => match.item.source === "databloem").map((match) => match.item.data);

    let discogs = null;
    try {
      const { kind, id } = release.discogs;
      const first = await fetcher.getText(`${DISCOGS_API}/${kind}s/${id}`);
      if (first.status !== 200) throw new Error(`HTTP ${first.status} for ${kind} ${id}`);
      const master = kind === "master" ? JSON.parse(first.body) : null;
      let main = kind === "release" ? JSON.parse(first.body) : null;
      if (master?.main_release) main = JSON.parse(await text(`${DISCOGS_API}/releases/${master.main_release}`));
      const aliases = release.credit?.alias ? [release.credit.alias] : [];
      const artistFilter = release.type === "compilation-appearance" ? (name) => isOophoiCredit(name, aliases) : undefined;
      discogs = summarizeDiscogs({ master, release: main, artistFilter });
    } catch (error) {
      failures.push(`Discogs ${release.slug}: ${error.message}`);
    }

    // Candidates in priority order; downloads stop at the first one larger than the current cover.
    const current = release.cover ? await sizeOf(resolve(releasesDir, release.cover)) : null;
    const offers = [
      ...bandcamp.filter((album) => album.coverUrl).map((album) => ({ source: "bandcamp", url: album.coverUrl })),
      ...databloem.flatMap((product) => product.images.slice(0, 1).map((url) => ({ source: "databloem", url }))),
      ...(discogs?.image?.url ? [{ source: "discogs", url: discogs.image.url }] : []),
    ].sort((a, b) => COVER_PRIORITY.indexOf(a.source) - COVER_PRIORITY.indexOf(b.source));
    let cover = null;
    for (const offer of offers) {
      try {
        const download = await fetcher.getBuffer(offer.url);
        const size = download.status === 200 ? imageSize(download.body) : null;
        if (!size) {
          failures.push(`Cover ${release.slug} (${offer.source}): not an image (HTTP ${download.status}) ${offer.url}`);
          continue;
        }
        const candidate = { ...offer, ...size };
        if (selectCover([candidate], current)) {
          const file = join(candidatesDir, `${release.slug}.${offer.source}.${extensionFor(size.format)}`);
          await writeFile(file, download.body);
          cover = { ...candidate, file: repoPath(file), current: current ? { width: current.width, height: current.height } : null };
          break;
        }
      } catch (error) {
        failures.push(`Cover ${release.slug} (${offer.source}): ${error.message}`);
      }
    }

    const proposal = buildProposal({ release, discogs, bandcamp, databloem });
    proposals.push({
      ...proposal,
      file: repoPath(path),
      discogsReleaseId: discogs?.releaseId ?? null,
      matches: matches.map((match) => ({ source: match.item.source, id: match.item.id, url: match.item.url, kind: match.kind })),
      cover,
    });
  }

  const strip = ({ item, ...rest }) => ({ item: { source: item.source, id: item.id, title: item.title, credit: item.credit ?? null, year: item.year ?? null, url: item.url }, ...rest });
  const ambiguous = matching.ambiguous.map(strip);
  const unmatched = matching.unmatched.map(strip);
  const generatedAt = new Date().toISOString();
  await writeFile(proposalsFile, `${JSON.stringify({ generatedAt, proposals, ambiguous, unmatched, failures }, null, 2)}\n`);
  await writeFile(reportFile, renderReport({ proposals, ambiguous, unmatched, failures, generatedAt }));
  console.log(`\nWrote ${repoPath(proposalsFile)} and ${repoPath(reportFile)}${failures.length ? ` (${failures.length} fetch failures, see report)` : ""}`);
}

// ---------------------------------------------------------------------------
// Apply mode

async function runApply() {
  if (!existsSync(proposalsFile)) {
    console.error(`No proposals at ${repoPath(proposalsFile)}; run the fetch mode first.`);
    process.exit(1);
  }
  const { proposals } = JSON.parse(await readFile(proposalsFile, "utf8"));
  const bySlug = new Map(proposals.map((proposal) => [proposal.slug, proposal]));
  const unknown = (args.only ?? []).filter((slug) => !bySlug.has(slug));
  if (unknown.length) {
    console.error(`No proposal for: ${unknown.join(", ")}`);
    process.exit(1);
  }
  const selected = args.only ? args.only.map((slug) => bySlug.get(slug)) : proposals;
  const releases = new Map((await loadReleases()).map((release) => [release.data.slug, release]));

  let written = 0;
  for (const proposal of selected) {
    const entry = releases.get(proposal.slug);
    if (!entry) {
      console.warn(`${proposal.slug}: release file not found, skipped`);
      continue;
    }
    const plan = { ...proposal };
    let coverFile = null;
    if (plan.cover) {
      // Re-check against the cover as it is now: a better one may have been added by hand since.
      const current = entry.data.cover ? await sizeOf(resolve(releasesDir, entry.data.cover)) : null;
      const cached = resolve(plan.cover.file);
      if (!existsSync(cached) || !selectCover([plan.cover], current)) plan.cover = null;
      else coverFile = `${proposal.slug}.${extensionFor(plan.cover.format)}`;
    }
    const { release, applied, skipped } = applyProposal(entry.data, plan, { coverRef: coverRef(coverFile) });
    if (applied.length === 0) {
      if (skipped.length) console.log(`${proposal.slug}: nothing applied (${skipped.join(", ")})`);
      continue;
    }
    if (coverFile) {
      await mkdir(coversDir, { recursive: true });
      await copyFile(resolve(plan.cover.file), join(coversDir, coverFile));
    }
    await writeFile(entry.path, `${JSON.stringify(release, null, 2)}\n`);
    written++;
    console.log(`${proposal.slug}: ${applied.join(", ")}${skipped.length ? `; skipped ${skipped.join(", ")}` : ""}`);
  }
  console.log(`\nUpdated ${written} release file(s). Conflicts and note proposals were not applied; see docs/enrichment-report.md.`);
}

if (args.apply) await runApply();
else await runFetch();
