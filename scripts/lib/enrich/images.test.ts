import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { imageSize } from "./image-size.mjs";
import { selectCover } from "./cover.mjs";

// Smallest useful JPEG: SOI, an APP0 segment to skip, a DHT segment (C4, must not be read as a frame), then SOF0.
const jpeg = (width: number, height: number, sof = 0xc0) =>
  Buffer.from([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46,
    0xff, 0xc4, 0x00, 0x03, 0x00,
    0xff, sof, 0x00, 0x0b, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 0x01, 0x22, 0x00,
    0xff, 0xd9,
  ]);

const png = (width: number, height: number) => {
  const buffer = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
};

describe("imageSize", () => {
  it("reads the frame header of a baseline and a progressive JPEG", () => {
    expect(imageSize(jpeg(1400, 1386))).toEqual({ format: "jpeg", width: 1400, height: 1386 });
    expect(imageSize(jpeg(600, 600, 0xc2))).toEqual({ format: "jpeg", width: 600, height: 600 });
  });

  it("reads a PNG header", () => {
    expect(imageSize(png(990, 990))).toEqual({ format: "png", width: 990, height: 990 });
  });

  it("reads a legacy cover thumbnail", () => {
    // A copy of the legacy amnios thumbnail, kept as a fixture because --apply replaces the files in src/assets/covers.
    const thumb = readFileSync(new URL("./fixtures/legacy-thumbnail.jpg", import.meta.url));
    const size = imageSize(thumb);
    expect(size?.format).toBe("jpeg");
    expect(Math.max(size!.width, size!.height)).toBeLessThanOrEqual(90);
  });

  it("returns null for anything else or a truncated file", () => {
    expect(imageSize(Buffer.from("<html>403</html>"))).toBeNull();
    expect(imageSize(jpeg(10, 10).subarray(0, 12))).toBeNull();
  });
});

describe("selectCover", () => {
  const bandcamp = { source: "bandcamp", url: "bc", file: "bc.jpg", width: 1400, height: 1400 };
  const databloem = { source: "databloem", url: "db", file: "db.jpg", width: 990, height: 990 };
  const discogs = { source: "discogs", url: "dc", file: "dc.jpg", width: 600, height: 597 };

  it("prefers Bandcamp, then Databloem, then Discogs whatever the input order", () => {
    expect(selectCover([discogs, databloem, bandcamp], { width: 90, height: 90 })?.source).toBe("bandcamp");
    expect(selectCover([discogs, databloem], { width: 90, height: 90 })?.source).toBe("databloem");
    expect(selectCover([discogs], null)?.source).toBe("discogs");
  });

  it("only proposes a cover larger than the current one", () => {
    expect(selectCover([discogs], { width: 600, height: 600 })).toBeNull();
    expect(selectCover([discogs, { ...bandcamp, width: 500, height: 500 }], { width: 550, height: 550 })?.source).toBe("discogs");
  });

  it("skips candidates that failed to download or measure", () => {
    expect(selectCover([{ ...bandcamp, width: undefined, height: undefined }, discogs], null)?.source).toBe("discogs");
    expect(selectCover([], null)).toBeNull();
  });
});
