// Staged writes for the legacy migration: everything is written into staging directories next to
// the real ones, and the real directories are only replaced once every file was written.
import { existsSync } from "node:fs";
import { rename as fsRename, rm as fsRm } from "node:fs/promises";

/** `<parent>/.<name>.<suffix>`, keeping the separator style of the given path. */
const siblingPath = (target, suffix) => {
  const cut = Math.max(target.lastIndexOf("/"), target.lastIndexOf("\\"));
  return `${target.slice(0, cut + 1)}.${target.slice(cut + 1)}.${suffix}`;
};

/** Where new files for `target` are written before the swap. */
export const stagingPathFor = (target) => siblingPath(target, "staging");

/** Where `target` is parked during the swap, so it can be restored if a later step fails. */
export const backupPathFor = (target) => siblingPath(target, "backup");

/**
 * @param {{ unparsed: unknown[], writeErrors: string[] }} state
 * @returns {string | null} why the staged files must not replace the real ones, or null when they may.
 */
export function abortReason({ unparsed, writeErrors }) {
  if (unparsed.length > 0) {
    return `${unparsed.length} legacy row(s) could not be parsed. Nothing was changed.`;
  }
  if (writeErrors.length > 0) {
    return `${writeErrors.length} file(s) could not be written to the staging directories. Nothing was changed.`;
  }
  return null;
}

/**
 * Replaces each `target` directory with its `staging` directory. Either every target is swapped,
 * or every target is restored as it was and the error is rethrown.
 * @param {{ staging: string, target: string }[]} pairs
 * @param {{ rename?: (from: string, to: string) => Promise<void> }} [ops] injectable for tests
 */
export async function swapStagedDirectories(pairs, { rename = fsRename } = {}) {
  for (const { staging, target } of pairs) {
    if (!existsSync(staging)) throw new Error(`Staging directory not found: ${staging}`);
    if (existsSync(backupPathFor(target))) {
      throw new Error(`A backup from an earlier run is still present: ${backupPathFor(target)}. Restore or delete it first.`);
    }
  }

  /** Completed renames, undone in reverse order on failure. */
  const done = [];
  try {
    for (const { staging, target } of pairs) {
      if (existsSync(target)) {
        await rename(target, backupPathFor(target));
        done.push({ from: target, to: backupPathFor(target) });
      }
      await rename(staging, target);
      done.push({ from: staging, to: target });
    }
  } catch (error) {
    try {
      for (const step of done.reverse()) await rename(step.to, step.from);
    } catch (restoreError) {
      throw new Error(
        `${error.message}. Restoring the originals also failed (${restoreError.message}); ` +
          "they are still in the .backup directories next to the targets.",
      );
    }
    throw error;
  }

  for (const { target } of pairs) await fsRm(backupPathFor(target), { recursive: true, force: true });
}
