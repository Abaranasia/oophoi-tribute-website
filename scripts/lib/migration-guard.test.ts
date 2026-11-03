import { describe, expect, it } from "vitest";
import { parseMigrationArgs, refusalReason } from "./migration-guard.mjs";

describe("parseMigrationArgs", () => {
  it("defaults to no legacy dir and no force", () => {
    expect(parseMigrationArgs([])).toEqual({ legacyDir: undefined, force: false });
  });

  it("reads the legacy dir and the --force flag in any order", () => {
    expect(parseMigrationArgs(["--force", "G:/Webs/oophoi"])).toEqual({ legacyDir: "G:/Webs/oophoi", force: true });
    expect(parseMigrationArgs(["G:/Webs/oophoi", "--force"])).toEqual({ legacyDir: "G:/Webs/oophoi", force: true });
  });
});

describe("refusalReason", () => {
  it("allows the first run into an empty collection", () => {
    expect(refusalReason({ existingReleaseFiles: 0, force: false })).toBeNull();
  });

  it("refuses to overwrite existing release files", () => {
    expect(refusalReason({ existingReleaseFiles: 163, force: false })).toMatch(/163 release files/);
  });

  it("allows an explicit forced re-run", () => {
    expect(refusalReason({ existingReleaseFiles: 163, force: true })).toBeNull();
  });
});
