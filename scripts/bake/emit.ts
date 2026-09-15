import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { Manifest, Resort, RunsFile } from "@/lib/types";
import type { Grid } from "./terrain";

/**
 * Writing the baked artifacts.
 *
 * Output lands in public/resorts/ and is committed to the repo: these files are
 * the product, and a monthly GitHub Action re-bakes and commits the diff
 * (SPEC §12). Keeping them in git is also what makes a bad bake reviewable
 * before it ships.
 */

export const OUTPUT_ROOT = "public/resorts";

/** SPEC §10. A resort over this drops resolution; the budget does not move. */
export const RESORT_BUDGET_BYTES = 5 * 1024 * 1024;

export interface HeightmapMeta {
  elevation_min_m: number;
  elevation_max_m: number;
  width: number;
  height: number;
}

function resortDir(slug: string): string {
  return path.join(process.cwd(), OUTPUT_ROOT, slug);
}

async function writeArtifact(slug: string, name: string, body: Buffer | string): Promise<void> {
  const dir = resortDir(slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), body);
}

/**
 * Elevation packed into RGB exactly as the terrarium source encodes it, so
 * `decodeElevation` reads our own artifact and the upstream tiles alike.
 *
 * The blue channel is zeroed: it would carry sub-metre detail that 30m source
 * data cannot support, and as near-random noise it would cost more in PNG size
 * than the whole rest of the image.
 */
export function encodeHeightmap(grid: Grid): { pixels: Buffer } & HeightmapMeta {
  const pixels = Buffer.alloc(grid.width * grid.height * 3);
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < grid.data.length; i++) {
    const e = grid.data[i];
    if (e < min) min = e;
    if (e > max) max = e;
    const packed = Math.round(e) + 32768;
    pixels[i * 3] = (packed >> 8) & 255;
    pixels[i * 3 + 1] = packed & 255;
  }

  return {
    pixels,
    elevation_min_m: Math.floor(min),
    elevation_max_m: Math.ceil(max),
    width: grid.width,
    height: grid.height,
  };
}

export async function writeHeightmap(slug: string, grid: Grid): Promise<HeightmapMeta> {
  const { pixels, ...meta } = encodeHeightmap(grid);
  const png = await sharp(pixels, {
    raw: { width: meta.width, height: meta.height, channels: 3 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeArtifact(slug, "heightmap.png", png);
  return meta;
}

export async function writeSatellite(slug: string, jpeg: Buffer): Promise<void> {
  await writeArtifact(slug, "satellite.jpg", jpeg);
}

export async function writeRuns(runs: RunsFile): Promise<void> {
  await writeArtifact(runs.slug, "runs.json", JSON.stringify(runs));
}

/** Replace this resort's entry and leave the rest alone, ordered for a readable diff. */
export function mergeResort(manifest: Manifest, resort: Resort): Manifest {
  const resorts = manifest.resorts.filter((r) => r.slug !== resort.slug);
  resorts.push(resort);
  resorts.sort((a, b) => a.slug.localeCompare(b.slug));
  return { generated_at: new Date().toISOString(), resorts };
}

export async function updateManifest(resort: Resort): Promise<Manifest> {
  const file = path.join(process.cwd(), OUTPUT_ROOT, "manifest.json");
  let current: Manifest = { generated_at: new Date().toISOString(), resorts: [] };
  try {
    current = JSON.parse(await readFile(file, "utf8")) as Manifest;
  } catch {
    // Nothing baked yet. An empty manifest is a valid state, not an error.
  }

  const next = mergeResort(current, resort);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(next, null, 2) + "\n");
  return next;
}

/** Report asset weight against the SPEC §10 budget. A resort over budget drops resolution. */
export async function reportAssetWeight(
  slug: string,
): Promise<{ bytes: number; withinBudget: boolean }> {
  const names = ["heightmap.png", "satellite.jpg", "runs.json"];
  let bytes = 0;
  for (const name of names) {
    try {
      bytes += (await stat(path.join(resortDir(slug), name))).size;
    } catch {
      // A missing artifact weighs nothing; the bake reports it elsewhere.
    }
  }
  return { bytes, withinBudget: bytes <= RESORT_BUDGET_BYTES };
}
