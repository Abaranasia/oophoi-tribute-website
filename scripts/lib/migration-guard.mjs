// The legacy migration is a one-time import: once it has run, the files in
// src/content/releases/ are the source of truth and are edited by hand.

/** @param {string[]} argv CLI arguments after the script path. */
export function parseMigrationArgs(argv) {
  const force = argv.includes("--force");
  const legacyDir = argv.find((arg) => !arg.startsWith("--"));
  return { legacyDir, force };
}

/**
 * @param {{ existingReleaseFiles: number, force: boolean }} state
 * @returns {string | null} why the migration must not run, or null when it may.
 */
export function refusalReason({ existingReleaseFiles, force }) {
  if (force || existingReleaseFiles === 0) return null;
  return (
    `src/content/releases/ already holds ${existingReleaseFiles} release files, which are now edited by hand. ` +
    "Re-running the migration would overwrite them and src/assets/covers/. Pass --force only if you really want that."
  );
}
