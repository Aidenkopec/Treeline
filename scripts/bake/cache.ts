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

/** Fetch a URL, reading from and writing to the on-disk cache. */
export async function cachedFetch(url: string, init?: RequestInit): Promise<Buffer> {
  const file = cachePath(url, typeof init?.body === "string" ? init.body : "");

  if (enabled) {
    try {
      return await readFile(file);
    } catch {
      // Not cached. Fall through to the network.
    }
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      // overpass-api.de answers 406 Not Acceptable without one of these, and
      // the tile services ask for it in their terms.
      "User-Agent": "treeline-bake (+https://treeline.aidenkopec.com)",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  const body = Buffer.from(await response.arrayBuffer());

  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
  return body;
}
