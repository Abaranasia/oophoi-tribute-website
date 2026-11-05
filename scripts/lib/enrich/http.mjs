// Cached, polite HTTP for the enrichment script. Every response is stored under cacheDir, so a re-run
// reads the disk instead of the network. Discogs allows about 25 unauthenticated requests a minute:
// requests to a rate-limited host are spaced, a low X-Discogs-Ratelimit-Remaining waits for the window,
// and 429/5xx responses are retried with a growing backoff.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const USER_AGENT = "OophoiSiteEnrich/1.0";
const RETRY_BASE_MS = 10_000;
const WINDOW_RESET_MS = 60_000;
const LOW_REMAINING = 2;
// Final answers worth remembering; anything else is retried or thrown, and never cached.
const CACHEABLE = new Set([200, 404, 410]);

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function cacheKey(url) {
  const { hostname } = new URL(url);
  return `${hostname}-${createHash("sha1").update(url).digest("hex").slice(0, 16)}`;
}

/**
 * @param {{ cacheDir: string, fetchImpl?: (url: string, init?: any) => Promise<Response>, sleep?: (ms: number) => Promise<unknown>,
 *   now?: () => number, log?: (message: string) => void, minIntervalMs?: Record<string, number>, maxRetries?: number,
 *   fallback?: ((url: string) => Promise<Uint8Array>) | null }} options
 */
export function createFetcher({
  cacheDir,
  fetchImpl = fetch,
  sleep = realSleep,
  now = Date.now,
  log = console.log,
  minIntervalMs = {},
  maxRetries = 4,
  fallback = null,
}) {
  const lastRequestAt = new Map();

  async function throttle(host) {
    const interval = minIntervalMs[host];
    if (!interval || !lastRequestAt.has(host)) return;
    const wait = lastRequestAt.get(host) + interval - now();
    if (wait > 0) await sleep(wait);
  }

  async function request(url) {
    const host = new URL(url).hostname;
    for (let attempt = 0; ; attempt++) {
      await throttle(host);
      lastRequestAt.set(host, now());
      const response = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT } });
      const remaining = response.headers.get("x-discogs-ratelimit-remaining");
      if (remaining !== null && Number(remaining) <= LOW_REMAINING) {
        log(`  rate limit nearly used (${remaining} left), waiting ${WINDOW_RESET_MS / 1000}s`);
        await sleep(WINDOW_RESET_MS);
      }
      if (response.status === 403 && fallback) {
        log(`  403 from ${host}, retrying through the fallback fetcher`);
        return { status: 200, body: Buffer.from(await fallback(url)) };
      }
      if (CACHEABLE.has(response.status)) return { status: response.status, body: Buffer.from(await response.arrayBuffer()) };
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt >= maxRetries) throw new Error(`HTTP ${response.status} for ${url}`);
      const backoff = RETRY_BASE_MS * 2 ** attempt;
      log(`  HTTP ${response.status} for ${url}, retry ${attempt + 1}/${maxRetries} in ${backoff / 1000}s`);
      await sleep(backoff);
    }
  }

  async function cached(url, kind) {
    const dir = join(cacheDir, kind);
    const metaFile = join(dir, `${cacheKey(url)}.json`);
    const bodyFile = join(dir, `${cacheKey(url)}.body`);
    if (existsSync(metaFile)) {
      const meta = JSON.parse(await readFile(metaFile, "utf8"));
      return { status: meta.status, body: meta.status === 200 ? await readFile(bodyFile) : null, cached: true };
    }
    const { status, body } = await request(url);
    await mkdir(dir, { recursive: true });
    if (status === 200) await writeFile(bodyFile, body);
    // The meta file is written last, so an interrupted run never leaves a half-written entry behind.
    await writeFile(metaFile, JSON.stringify({ url, status, fetchedAt: new Date().toISOString() }));
    return { status, body: status === 200 ? body : null, cached: false };
  }

  return {
    async getText(url) {
      const result = await cached(url, "http");
      return { ...result, body: result.body ? result.body.toString("utf8") : result.status === 200 ? "" : null };
    },
    getBuffer: (url) => cached(url, "files"),
  };
}
