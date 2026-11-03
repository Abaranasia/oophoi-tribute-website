// One-time import of the release tables of the 2013 legacy site into the `releases` content collection.
//
// Usage: node scripts/migrate-legacy.mjs [path/to/legacy/site] [--force]   (default: LEGACY_DIR or G:/Webs/oophoi)
//
// The import already ran: src/content/releases/*.json are now the source of truth and are edited
// by hand. The script refuses to run while release files exist; --force regenerates them and
// src/assets/covers/, discarding every hand edit.
//
// Every file is first written to staging directories next to the real ones. The real directories
// are only replaced when every legacy row parsed and every file was written; otherwise the staging
// directories are deleted and nothing changes.
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildReleases, decodeLatin1, KNOWN_SKIPPED_PAGES, parseLegacyPage, SOURCE_PAGES } from "./lib/legacy-parser.mjs";
import { parseMigrationArgs, refusalReason } from "./lib/migration-guard.mjs";
import { abortReason, stagingPathFor, swapStagedDirectories } from "./lib/staged-swap.mjs";

const args = parseMigrationArgs(process.argv.slice(2));
const legacyDir = resolve(args.legacyDir ?? process.env.LEGACY_DIR ?? "G:/Webs/oophoi");
const releasesDir = resolve("src/content/releases");
const coversDir = resolve("src/assets/covers");
const releasesStaging = stagingPathFor(releasesDir);
const coversStaging = stagingPathFor(coversDir);
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

// ---------------------------------------------------------------------------
// Parse (read-only)

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

// ---------------------------------------------------------------------------
// Write everything to the staging directories

const removeStaging = () =>
  Promise.all([rm(releasesStaging, { recursive: true, force: true }), rm(coversStaging, { recursive: true, force: true })]);

const writeErrors = [];
const missingCovers = [];
let coverCount = 0;

if (unparsed.length === 0) {
  await removeStaging();
  await mkdir(releasesStaging, { recursive: true });
  await mkdir(coversStaging, { recursive: true });

  for (const release of releases) {
    try {
      let cover;
      if (release.thumb) {
        const source = join(legacyDir, release.thumb);
        if (existsSync(source)) {
          // Every legacy thumbnail is a JPEG, whether named .jpg or .jpeg.
          cover = `${release.slug}.jpg`;
          await copyFile(source, join(coversStaging, cover));
          coverCount++;
        } else {
          missingCovers.push(`${release.slug}: ${release.thumb}`);
        }
      }
      // `cover` sits right after the Discogs block; JSON.stringify drops undefined keys.
      const { tracks, note, relatedTo, hidden, ...head } = release;
      const entry = { ...head, cover: cover && coverRef(cover), tracks, note, relatedTo, hidden };
      await writeFile(join(releasesStaging, `${release.slug}.json`), `${JSON.stringify(entry, null, 2)}\n`, "utf8");
    } catch (error) {
      writeErrors.push(`${release.slug}: ${error.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Summary

const countBy = (items, key) =>
  items.reduce((counts, item) => ({ ...counts, [key(item)]: (counts[key(item)] ?? 0) + 1 }), {});

console.log(`Legacy source: ${legacyDir}`);
console.log(`Legacy pages never read (informational): ${KNOWN_SKIPPED_PAGES.join(", ")}`);
console.log("\nRows parsed per page:");
for (const [file, count] of Object.entries(rowsPerPage)) console.log(`  ${file.padEnd(18)} ${count}`);
console.log("\nReleases per type (visible / hidden):");
const visible = countBy(releases.filter((r) => !r.hidden), (r) => r.type);
const hidden = countBy(releases.filter((r) => r.hidden), (r) => r.type);
for (const type of Object.keys({ ...visible, ...hidden })) {
  console.log(`  ${type.padEnd(24)} ${visible[type] ?? 0} / ${hidden[type] ?? 0}`);
}

if (missingCovers.length > 0) {
  console.log(`\nMissing cover thumbnails (${missingCovers.length}):`);
  for (const line of missingCovers) console.log(`  ${line}`);
}
if (unparsed.length > 0) {
  console.log(`\nRows that could not be parsed (${unparsed.length}):`);
  for (const row of unparsed) console.log(`  [${row.source}] ${row.reason}: ${row.snippet}`);
}
if (writeErrors.length > 0) {
  console.log(`\nFiles that could not be written (${writeErrors.length}):`);
  for (const line of writeErrors) console.log(`  ${line}`);
}

// ---------------------------------------------------------------------------
// Swap the staging directories in, or abort with nothing changed

const abort = abortReason({ unparsed, writeErrors });
if (abort) {
  await removeStaging();
  console.error(`\nAborted: ${abort}`);
  process.exit(1);
}

try {
  await swapStagedDirectories([
    { staging: releasesStaging, target: releasesDir },
    { staging: coversStaging, target: coversDir },
  ]);
} catch (error) {
  await removeStaging();
  // swapStagedDirectories restores the originals before rethrowing, and says so in the message
  // when even that failed (the next run then refuses to start until the backup is resolved).
  console.error(`\nAborted: could not swap the staging directories in: ${error.message}`);
  process.exit(1);
}

console.log(`\nWrote ${releases.length} release files and ${coverCount} covers.`);
