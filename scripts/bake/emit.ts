import type { Manifest, Resort, RunsFile } from "@/lib/types";

/**
 * Writing the baked artifacts.
 *
 * Output lands in public/resorts/ and is committed to the repo: these files are
 * the product, and a monthly GitHub Action re-bakes and commits the diff
 * (SPEC §12). Keeping them in git is also what makes a bad bake reviewable
 * before it ships.
 */

export const OUTPUT_ROOT = "public/resorts";

/** 16-bit PNG, so elevation survives the round trip at metre precision. */
export async function writeHeightmap(_slug: string, _grid: Float32Array): Promise<void> {
  throw new Error("Not implemented — phase 1");
}

export async function writeSatellite(_slug: string, _jpeg: Buffer): Promise<void> {
  throw new Error("Not implemented — phase 1");
}

export async function writeRuns(_runs: RunsFile): Promise<void> {
  throw new Error("Not implemented — phase 1");
}

/** Rewrite the manifest, replacing this resort's entry and leaving the rest alone. */
export async function updateManifest(_resort: Resort): Promise<Manifest> {
  throw new Error("Not implemented — phase 1");
}

/** Report asset weight against the SPEC §10 budget. A resort over budget drops resolution. */
export async function reportAssetWeight(
  _slug: string,
): Promise<{ bytes: number; withinBudget: boolean }> {
  throw new Error("Not implemented — phase 1");
}
