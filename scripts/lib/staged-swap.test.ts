import { mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { abortReason, backupPathFor, stagingPathFor, swapStagedDirectories } from "./staged-swap.mjs";

describe("stagingPathFor / backupPathFor", () => {
  it("places staging and backup directories next to the target, so a rename never crosses volumes", () => {
    expect(stagingPathFor("/site/src/content/releases")).toBe("/site/src/content/.releases.staging");
    expect(backupPathFor("/site/src/assets/covers")).toBe("/site/src/assets/.covers.backup");
  });
});

describe("abortReason", () => {
  it("allows the swap when every row parsed and every write succeeded", () => {
    expect(abortReason({ unparsed: [], writeErrors: [] })).toBeNull();
  });

  it("aborts when any legacy row could not be parsed", () => {
    expect(abortReason({ unparsed: [{ source: "albums1.html", reason: "no year found", snippet: "x" }], writeErrors: [] })).toMatch(
      /1 legacy row/,
    );
  });

  it("aborts when any staged write failed", () => {
    expect(abortReason({ unparsed: [], writeErrors: ["EACCES: covers/x.jpg"] })).toMatch(/1 file/);
  });
});

describe("swapStagedDirectories", () => {
  let root: string;
  const list = async (dir: string) => (await readdir(dir)).sort();

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "staged-swap-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const prepare = async (name: string, current: string[] | null, staged: string[]) => {
    const target = join(root, name);
    if (current) {
      await mkdir(target);
      for (const file of current) await writeFile(join(target, file), `old ${file}`);
    }
    const staging = stagingPathFor(target);
    await mkdir(staging);
    for (const file of staged) await writeFile(join(staging, file), `new ${file}`);
    return { staging, target };
  };

  it("replaces every target with its staged copy and leaves no staging or backup behind", async () => {
    const releases = await prepare("releases", ["a.json", "stale.json"], ["a.json", "b.json"]);
    const covers = await prepare("covers", ["a.jpg"], ["a.jpg"]);

    await swapStagedDirectories([releases, covers]);

    expect(await list(releases.target)).toEqual(["a.json", "b.json"]);
    expect(await readFile(join(releases.target, "a.json"), "utf8")).toBe("new a.json");
    expect(await list(root)).toEqual(["covers", "releases"]);
  });

  it("creates targets that did not exist yet", async () => {
    const releases = await prepare("releases", null, ["a.json"]);
    await swapStagedDirectories([releases]);
    expect(await list(releases.target)).toEqual(["a.json"]);
  });

  it("restores every original target when a later swap fails", async () => {
    const releases = await prepare("releases", ["a.json"], ["b.json"]);
    const covers = await prepare("covers", ["a.jpg"], ["b.jpg"]);
    let renames = 0;
    const failingRename = async (from: string, to: string) => {
      renames++;
      // 1: releases → backup, 2: staging → releases, 3: covers → backup, 4: staging → covers (fails)
      if (renames === 4) throw new Error("EBUSY: covers is locked");
      await rename(from, to);
    };

    await expect(swapStagedDirectories([releases, covers], { rename: failingRename })).rejects.toThrow(/EBUSY/);

    expect(await readFile(join(releases.target, "a.json"), "utf8")).toBe("old a.json");
    expect(await list(releases.target)).toEqual(["a.json"]);
    expect(await list(covers.target)).toEqual(["a.jpg"]);
    expect(existsSync(backupPathFor(releases.target))).toBe(false);
    expect(existsSync(backupPathFor(covers.target))).toBe(false);
  });

  it("says where the originals are when restoring them fails too", async () => {
    const releases = await prepare("releases", ["a.json"], ["b.json"]);
    let renames = 0;
    const brokenRename = async (from: string, to: string) => {
      renames++;
      // 1: releases → backup, 2: staging → releases (fails), 3: restore (fails)
      if (renames >= 2) throw new Error("EPERM");
      await rename(from, to);
    };

    await expect(swapStagedDirectories([releases], { rename: brokenRename })).rejects.toThrow(/\.backup directories/);
    expect(await list(backupPathFor(releases.target))).toEqual(["a.json"]);
  });

  it("still succeeds and reports the leftover backups when removing them fails after the swap", async () => {
    const releases = await prepare("releases", ["a.json"], ["b.json"]);
    const failingRm = async () => {
      throw new Error("EBUSY: backup is locked");
    };

    const result = await swapStagedDirectories([releases], { rm: failingRm });

    expect(await list(releases.target)).toEqual(["b.json"]);
    expect(result.leftoverBackups).toEqual([backupPathFor(releases.target)]);
  });

  it("reports no leftover backups when cleanup succeeds", async () => {
    const releases = await prepare("releases", ["a.json"], ["b.json"]);
    expect(await swapStagedDirectories([releases])).toEqual({ leftoverBackups: [] });
  });

  it("refuses to start when a staging directory is missing, without touching any target", async () => {
    const releases = await prepare("releases", ["a.json"], ["b.json"]);
    const missing = { staging: join(root, ".covers.staging"), target: join(root, "covers") };

    await expect(swapStagedDirectories([releases, missing])).rejects.toThrow(/staging directory/i);
    expect(await list(releases.target)).toEqual(["a.json"]);
  });
});
