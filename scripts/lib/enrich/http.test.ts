import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFetcher } from "./http.mjs";

const response = (status: number, body: string | Uint8Array, headers: Record<string, string> = {}) =>
  new Response(body as BodyInit, { status, headers });

describe("createFetcher", () => {
  let cacheDir: string;
  let sleep: ReturnType<typeof vi.fn<(ms: number) => Promise<void>>>;
  let clock: number;

  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), "enrich-http-"));
    clock = 0;
    sleep = vi.fn<(ms: number) => Promise<void>>(async (ms: number) => {
      clock += ms;
    });
  });

  afterEach(async () => {
    await rm(cacheDir, { recursive: true, force: true });
  });

  const make = (fetchImpl: (url: string, init?: RequestInit) => Promise<Response>, extra = {}) =>
    createFetcher({ cacheDir, fetchImpl, sleep, now: () => clock, log: () => {}, ...extra });

  it("sends the tool User-Agent and caches text responses on disk", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => response(200, "hello"));
    const first = make(fetchImpl);
    expect(await first.getText("https://example.org/a")).toEqual({ status: 200, body: "hello", cached: false });
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ headers: { "User-Agent": "OophoiSiteEnrich/1.0" } });

    const second = make(fetchImpl);
    expect(await second.getText("https://example.org/a")).toEqual({ status: 200, body: "hello", cached: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("caches a 404 so a re-run does not ask again", async () => {
    const fetchImpl = vi.fn(async () => response(404, "missing"));
    await make(fetchImpl).getText("https://example.org/gone");
    expect((await make(fetchImpl).getText("https://example.org/gone")).status).toBe(404);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("spaces requests to the same rate-limited host", async () => {
    const fetchImpl = vi.fn(async () => response(200, "{}", { "X-Discogs-Ratelimit-Remaining": "20" }));
    const fetcher = make(fetchImpl, { minIntervalMs: { "api.discogs.com": 2500 } });
    await fetcher.getText("https://api.discogs.com/releases/1");
    await fetcher.getText("https://api.discogs.com/releases/2");
    expect(sleep).toHaveBeenCalledWith(2500);
  });

  it("waits for the window to reset when Discogs reports few requests left", async () => {
    const fetchImpl = vi.fn(async () => response(200, "{}", { "X-Discogs-Ratelimit-Remaining": "1" }));
    await make(fetchImpl).getText("https://api.discogs.com/releases/1");
    expect(sleep).toHaveBeenCalledWith(60_000);
  });

  it("retries a 429 with a growing backoff, then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response(429, "slow down"))
      .mockResolvedValueOnce(response(429, "slow down"))
      .mockResolvedValueOnce(response(200, "ok"));
    const result = await make(fetchImpl).getText("https://api.discogs.com/releases/1");
    expect(result.body).toBe("ok");
    expect(sleep).toHaveBeenCalledWith(10_000);
    expect(sleep).toHaveBeenCalledWith(20_000);
  });

  it("gives up after the last retry and does not cache the failure", async () => {
    const fetchImpl = vi.fn(async () => response(503, "down"));
    await expect(make(fetchImpl, { maxRetries: 2 }).getText("https://example.org/x")).rejects.toThrow(/503/);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    fetchImpl.mockResolvedValue(response(200, "back"));
    expect((await make(fetchImpl).getText("https://example.org/x")).body).toBe("back");
  });

  it("uses the fallback fetcher when a host answers 403", async () => {
    const fetchImpl = vi.fn(async () => response(403, "blocked"));
    const fallback = vi.fn(async () => Buffer.from("via fallback"));
    const result = await make(fetchImpl, { fallback }).getText("https://oophoi.bandcamp.com/music");
    expect(result.body).toBe("via fallback");
    expect(fallback).toHaveBeenCalledWith("https://oophoi.bandcamp.com/music");
  });

  it("downloads binary files once", async () => {
    const fetchImpl = vi.fn(async () => response(200, new Uint8Array([0xff, 0xd8, 0xff])));
    const first = await make(fetchImpl).getBuffer("https://example.org/a.jpg");
    const second = await make(fetchImpl).getBuffer("https://example.org/a.jpg");
    expect([...first.body!]).toEqual([0xff, 0xd8, 0xff]);
    expect(second).toMatchObject({ status: 200, cached: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
