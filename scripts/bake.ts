#!/usr/bin/env tsx
/**
 * The bake pipeline (SPEC §5.1).
 *
 * Runs on a laptop or in a scheduled GitHub Action and writes artifacts that
 * are committed to the repo. It never runs on Vercel and never runs inside a
 * request: a bake is minutes of rate-limited Overpass queries and dozens of
 * tile downloads, which is precisely why it cannot be a runtime call.
 *
 *   npm run bake -- --resort lake-louise    bake one resort
 *   npm run bake -- --all                   bake every resort in resorts.json
 *   npm run bake -- --check lake-louise     report OSM coverage, write nothing
 */

import { readFile } from "node:fs/promises";

interface ResortInput {
  slug: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  zoom: number;
  texture_quality: number;
  vertical_exaggeration: number;
}

async function loadResorts(): Promise<ResortInput[]> {
  const raw = await readFile(new URL("../resorts.json", import.meta.url), "utf8");
  return (JSON.parse(raw) as { resorts: ResortInput[] }).resorts;
}

/**
 * Bake one resort end to end:
 *   1. Resolve bounds from OSM landuse=winter_sports
 *   2. Download + stitch + decode terrarium elevation tiles
 *   3. Download + stitch Esri imagery for the same box
 *   4. Query Overpass for piste:type=downhill ways — downhill only, see §8
 *   5. Sample elevation along each polyline
 *   6. Compute per-run derived stats (§6)
 *   7. Emit heightmap.png, satellite.jpg, runs.json, manifest entry
 */
async function bakeResort(resort: ResortInput): Promise<void> {
  throw new Error(`Not implemented — phase 1 (${resort.slug})`);
}

/**
 * Coverage check, writing nothing.
 *
 * Exists so a resort with poor OSM coverage is caught before it is baked
 * rather than after it looks wrong on screen (SPEC §13).
 */
async function checkResort(resort: ResortInput): Promise<void> {
  throw new Error(`Not implemented — phase 1 (${resort.slug})`);
}

function findResort(resorts: ResortInput[], slug: string): ResortInput {
  const match = resorts.find((r) => r.slug === slug);
  if (!match) {
    const known = resorts.map((r) => r.slug).join(", ");
    throw new Error(`Unknown resort "${slug}". Known resorts: ${known}`);
  }
  return match;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const resorts = await loadResorts();

  const checkIndex = args.indexOf("--check");
  if (checkIndex !== -1) {
    await checkResort(findResort(resorts, args[checkIndex + 1]));
    return;
  }

  if (args.includes("--all")) {
    for (const resort of resorts) {
      await bakeResort(resort);
    }
    return;
  }

  const resortIndex = args.indexOf("--resort");
  if (resortIndex !== -1) {
    await bakeResort(findResort(resorts, args[resortIndex + 1]));
    return;
  }

  console.error(
    [
      "Usage:",
      "  npm run bake -- --resort <slug>   bake one resort",
      "  npm run bake -- --all             bake every resort",
      "  npm run bake -- --check <slug>    report coverage, write nothing",
      "",
      `Known resorts: ${resorts.map((r) => r.slug).join(", ")}`,
    ].join("\n"),
  );
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
