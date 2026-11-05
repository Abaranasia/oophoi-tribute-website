// One-time import of the release tables of the 2013 legacy site into the `releases` content collection.
//
// Usage: node scripts/migrate-legacy.mjs [path/to/legacy/site] [--force]   (default: LEGACY_DIR or G:/Webs/oophoi)
//
// The import already ran: src/content/releases/*.json are now the source of truth and are edited
// by hand. The script refuses to run while release files exist; --force wipes and regenerates
// them and src/assets/covers/, discarding every hand edit.
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildReleases, decodeLatin1, IGNORED_PAGES, parseLegacyPage, SOURCE_PAGES } from "./lib/legacy-parser.mjs";
import { parseMigrationArgs, refusalReason } from "./lib/migration-guard.mjs";

const args = parseMigrationArgs(process.argv.slice(2));
const legacyDir = resolve(args.legacyDir ?? process.env.LEGACY_DIR ?? "G:/Webs/oophoi");
const releasesDir = resolve("src/content/releases");
const coversDir = resolve("src/assets/covers");
// Relative to a file in src/content/releases, as Astro's image() expects.
const coverRef = (file) => `../../assets/covers/${file}`;

const existingReleaseFiles = existsSync(releasesDir)
  ? (await readdir(releasesDir)).filter((file) => file.endsWith(".json")).length
  : 0;
const refusal = refusalReason({ existingReleaseFiles, force: args.force });
if (refusal) {
  console.error(refusal);
  process.exit(1);
}

if (!existsSync(legacyDir)) {
  console.error(`Legacy site not found at ${legacyDir}`);
  process.exit(1);
}

const rows = [];
const unparsed = [];
const rowsPerPage = {};
for (const page of SOURCE_PAGES) {
  const html = decodeLatin1(await readFile(join(legacyDir, page.file)));
  const result = parseLegacyPage(html, page);
  rows.push(...result.rows);
  unparsed.push(...result.unparsed);
  rowsPerPage[page.file] = result.rows.length;
}

const releases = buildReleases(rows);

await mkdir(releasesDir, { recursive: true });
await mkdir(coversDir, { recursive: true });
for (const file of await readdir(releasesDir)) {
  if (file.endsWith(".json")) await rm(join(releasesDir, file));
}
await rm(coversDir, { recursive: true, force: true });
await mkdir(coversDir, { recursive: true });

const missingCovers = [];
let coverCount = 0;
for (const release of releases) {
  let cover;
  if (release.thumb) {
    const source = join(legacyDir, release.thumb);
    if (existsSync(source)) {
      // Every legacy thumbnail is a JPEG, whether named .jpg or .jpeg.
      cover = `${release.slug}.jpg`;
      await copyFile(source, join(coversDir, cover));
      coverCount++;
    } else {
      missingCovers.push(`${release.slug}: ${release.thumb}`);
    }
  }
  // `cover` sits right after the Discogs block; JSON.stringify drops undefined keys.
  const { tracks, note, relatedTo, hidden, ...head } = release;
  const entry = { ...head, cover: cover && coverRef(cover), tracks, note, relatedTo, hidden };
  await writeFile(join(releasesDir, `${release.slug}.json`), `${JSON.stringify(entry, null, 2)}\n`, "utf8");
}

// ---------------------------------------------------------------------------
// Summary

const countBy = (items, key) =>
  items.reduce((counts, item) => ({ ...counts, [key(item)]: (counts[key(item)] ?? 0) + 1 }), {});

console.log(`Legacy source: ${legacyDir}`);
console.log(`Ignored legacy files: ${IGNORED_PAGES.join(", ")}`);
console.log("\nRows parsed per page:");
for (const [file, count] of Object.entries(rowsPerPage)) console.log(`  ${file.padEnd(18)} ${count}`);
console.log("\nReleases per type (visible / hidden):");
const visible = countBy(releases.filter((r) => !r.hidden), (r) => r.type);
const hidden = countBy(releases.filter((r) => r.hidden), (r) => r.type);
for (const type of Object.keys({ ...visible, ...hidden })) {
  console.log(`  ${type.padEnd(24)} ${visible[type] ?? 0} / ${hidden[type] ?? 0}`);
}
console.log(`\nWrote ${releases.length} release files and ${coverCount} covers.`);

if (missingCovers.length > 0) {
  console.log(`\nMissing cover thumbnails (${missingCovers.length}):`);
  for (const line of missingCovers) console.log(`  ${line}`);
}
if (unparsed.length > 0) {
  console.log(`\nRows that could not be parsed (${unparsed.length}):`);
  for (const row of unparsed) console.log(`  [${row.source}] ${row.reason}: ${row.snippet}`);
  process.exitCode = 1;
} else {
  console.log("\nRows that could not be parsed: none");
}
