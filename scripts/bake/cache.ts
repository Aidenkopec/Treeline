import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * On-disk cache for bake-time downloads.
 *
 * A bake is ~100 tiles plus a rate-limited Overpass query, and tuning the
 * pipeline means running it repeatedly against the same free, keyless services
 * SPEC §7 depends on. The cache is as much politeness as speed.
 */

const CACHE_ROOT = path.join(process.cwd(), ".bake-cache");

let enabled = true;

/** `--no-cache`: force every request to go to the network. */
export function disableCache(): void {
  enabled = false;
}

function cachePath(url: string, body: string): string {
  const key = createHash("sha256").update(`${url}\n${body}`).digest("hex");
  return path.join(CACHE_ROOT, key.slice(0, 2), key);
}

/** Overpass is free and busy; a 504 means "come back later", not "this failed". */
const RETRY_STATUSES = new Set([429, 502, 503, 504]);
const RETRY_DELAYS_MS = [2000, 8000, 20000];

async function download(url: string, init?: RequestInit): Promise<Buffer> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, {
      ...init,
      headers: {
        // overpass-api.de answers 406 Not Acceptable without one of these, and
        // the tile services ask for it in their terms.
        "User-Agent": "treeline-bake (+https://treeline.aidenkopec.com)",
        ...init?.headers,
      },
    });

    if (response.ok) return Buffer.from(await response.arrayBuffer());

    const delay = RETRY_DELAYS_MS[attempt];
    if (delay === undefined || !RETRY_STATUSES.has(response.status)) {
      throw new Error(`${response.status} ${response.statusText} for ${url}`);
    }
    console.warn(`  ${response.status} from ${new URL(url).host}, retrying in ${delay / 1000}s`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

/**
 * Fetch a URL, reading from and writing to the on-disk cache.
 *
 * `accept` guards what is allowed to *be* a cache entry. Overpass answers a
 * busy server with 200 and an error body — sometimes HTML, sometimes JSON
 * carrying a `remark` and no elements — so status alone cannot tell a bad
 * answer from a good one, and this cache has no TTL and no eviction. Without
 * the guard one busy minute poisons a key until `.bake-cache` is deleted by
 * hand, and the JSON variant is worse than the HTML one: it bakes a resort with
 * nothing in it rather than throwing.
 *
 * It runs on the read as well as the write, so a cache already holding a bad
 * answer heals itself on the next bake instead of needing to be cleared.
 */
export async function cachedFetch(
  url: string,
  init?: RequestInit,
  accept?: (body: Buffer) => boolean,
): Promise<Buffer> {
  const file = cachePath(url, typeof init?.body === "string" ? init.body : "");

  if (enabled) {
    try {
      const cached = await readFile(file);
      if (!accept || accept(cached)) return cached;
    } catch {
      // Not cached. Fall through to the network.
    }
  }

  const body = await download(url, init);
  if (accept && !accept(body)) {
    throw new Error(`Unusable answer from ${new URL(url).host} for ${url}`);
  }

  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
  return body;
}
