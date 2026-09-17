#!/usr/bin/env tsx
/**
 * The bake pipeline (SPEC §5.1). Runs on a laptop or in a scheduled GitHub Action and
 * writes artifacts committed to the repo. Never on Vercel and never inside a request: a
 * bake is minutes of rate-limited Overpass queries and dozens of tile downloads.
 */

import { readFile } from "node:fs/promises";
import type { Resort, RunsFile } from "@/lib/types";
import type { ResortInput } from "@/lib/manifest";
import { disableCache } from "./bake/cache";
import {
  reportAssetWeight,
  updateManifest,
  writeHeightmap,
  writeMountain,
  writeRuns,
  writeSatellite,
} from "./bake/emit";
import { bakeSatelliteTexture, IMAGERY_ZOOM_OFFSET } from "./bake/imagery";
import { fetchMosaic } from "./bake/mosaic";
import {
  boundsFromElements,
  downhillRunsQuery,
  isInboundsDownhill,
  mountainQuery,
  type OverpassArea,
  type OverpassPlace,
  type OverpassWay,
  resortBoundsQuery,
  runQuery,
  unionBounds,
} from "./bake/overpass";
import { deriveRun, summariseCoverage } from "./bake/runs";
import { deriveLift, derivePlace, summariseMountain } from "./bake/mountain";
import { decodeHeightmap } from "@/lib/elevation";
import { terrariumTileUrl } from "./bake/terrarium";
import {
  metresPerPixel,
  mosaicBounds,
  mosaicSize,
  tileRangeForBounds,
  zoomedRange,
} from "./bake/tiles";

async function loadResorts(): Promise<ResortInput[]> {
  const raw = await readFile(new URL("../resorts.json", import.meta.url), "utf8");
  return (JSON.parse(raw) as { resorts: ResortInput[] }).resorts;
}

/** Resolve the resort's box, the runs inside it, and what is built on it. */
async function resolveTerrain(resort: ResortInput) {
  const areas = await runQuery<OverpassArea>(resortBoundsQuery(resort.lat, resort.lon));
  const polygon = boundsFromElements(areas.elements, resort.lat, resort.lon);
  if (!polygon) {
    throw new Error(
      `No landuse=winter_sports area near ${resort.slug} (${resort.lat}, ${resort.lon}). ` +
        `Check the anchor in resorts.json.`,
    );
  }

  const found = await runQuery<OverpassWay>(downhillRunsQuery(polygon));
  const ways = found.elements.filter(isInboundsDownhill);

  // Not unioned into `bounds`: widening the box moves the mosaic and stales every heightmap.
  const mountain = await runQuery<OverpassWay & OverpassPlace>(
    mountainQuery(resort.lat, resort.lon),
  );

  // Runs into the box before choosing tiles, or a way past the polygon clips at the edge.
  const bounds = ways.reduce((b, w) => unionBounds(b, w.geometry ?? []), polygon);
  return { elements: found.elements, ways, mountain: mountain.elements, bounds };
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

/**
 * Bake one resort end to end: bounds from OSM, terrarium elevation and Esri imagery over
 * the same box, `piste:type=downhill` ways only (§8), elevation sampled along each
 * polyline, per-run stats (§6), then heightmap.png, satellite.jpg, runs.json and manifest.
 */
async function bakeResort(resort: ResortInput): Promise<void> {
  console.log(`\n${resort.name} (${resort.slug})`);

  const { ways, mountain, bounds } = await resolveTerrain(resort);
  const range = tileRangeForBounds(bounds, resort.zoom);
  const { width, height } = mosaicSize(range);
  console.log(`  ${ways.length} downhill runs, heightmap ${width}x${height} at z${resort.zoom}`);

  const mosaic = await fetchMosaic(range, terrariumTileUrl);
  const grid = {
    data: decodeHeightmap(mosaic.data, mosaic.width, mosaic.height, 3),
    width: mosaic.width,
    height: mosaic.height,
    cellSize: metresPerPixel(resort.lat, resort.zoom),
  };

  const runs = ways.map((way) => deriveRun(way, grid, range));
  const baked_at = new Date().toISOString().slice(0, 10);

  const heightmap = await writeHeightmap(resort.slug, grid);
  console.log(`  elevation ${heightmap.elevation_min_m}-${heightmap.elevation_max_m} m`);

  const texture = await bakeSatelliteTexture(range, resort.texture_quality);
  await writeSatellite(resort.slug, texture);
  const imagery = mosaicSize(zoomedRange(range, IMAGERY_ZOOM_OFFSET));
  console.log(`  satellite ${imagery.width}x${imagery.height} at q${resort.texture_quality}`);

  const runsFile: RunsFile = { slug: resort.slug, baked_at, runs };
  await writeRuns(runsFile);

  const lifts = mountain
    .map((el) => deriveLift(el, grid, range))
    .filter((lift): lift is NonNullable<typeof lift> => lift !== null)
    // Biggest first, and baked that way, because the lift list does not sort.
    .sort((a, b) => b.vertical_m - a.vertical_m || a.id.localeCompare(b.id));
  const places = mountain
    .map((el) => derivePlace(el, grid, range))
    .filter((place): place is NonNullable<typeof place> => place !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  await writeMountain({ slug: resort.slug, baked_at, lifts, places });
  console.log(`  ${lifts.length} lifts, ${places.length} named places`);

  const entry: Resort = {
    slug: resort.slug,
    name: resort.name,
    country: resort.country,
    // The mosaic rectangle, not the OSM polygon: a mismatch offsets every run in the scene.
    bounds: mosaicBounds(range),
    lat: resort.lat,
    lon: resort.lon,
    timezone: resort.timezone,
    ...heightmap,
    metres_per_pixel: grid.cellSize,
    vertical_exaggeration: resort.vertical_exaggeration,
    baked_at,
  };
  await updateManifest(entry);

  const weight = await reportAssetWeight(resort.slug);
  console.log(
    `  ${mb(weight.bytes)} ${weight.withinBudget ? "within" : "OVER"} the 5 MB budget (SPEC §10)`,
  );
  if (!weight.withinBudget) {
    console.warn(`  Lower zoom or texture_quality for ${resort.slug} — the budget does not move.`);
  }
}

/**
 * Coverage check, writing nothing. Exists so a resort with poor OSM coverage is caught
 * before it is baked rather than after it looks wrong on screen (SPEC §13).
 */
async function checkResort(resort: ResortInput): Promise<void> {
  const { elements, mountain, bounds } = await resolveTerrain(resort);
  const c = summariseCoverage(elements);
  const range = tileRangeForBounds(bounds, resort.zoom);
  const m = summariseMountain(mountain, range);
  const dem = mosaicSize(range);
  const imagery = mosaicSize(zoomedRange(range, IMAGERY_ZOOM_OFFSET));
  const pct = (n: number) => (c.kept === 0 ? "0%" : `${Math.round((n / c.kept) * 100)}%`);

  const grades = Object.entries(c.byDifficulty)
    .sort((a, b) => b[1] - a[1])
    .map(([g, n]) => `${g} ${n}`)
    .join(", ");

  console.log(`\n${resort.name} (${resort.slug})`);
  console.log(
    `  bounds              ${bounds.west.toFixed(4)},${bounds.south.toFixed(4)} to ${bounds.east.toFixed(4)},${bounds.north.toFixed(4)}`,
  );
  console.log(`  downhill runs       ${c.kept} kept, ${c.rejected} rejected of ${c.ways} returned`);
  console.log(`  named               ${c.named} (${pct(c.named)})`);
  console.log(`  graded              ${c.graded} (${pct(c.graded)})`);
  console.log(`  grades              ${grades}`);
  console.log(
    `  distinct names      ${c.distinctNames}, up to ${c.mostWaysPerName} ways share one`,
  );
  console.log(
    `  length              ${(c.totalLengthM / 1000).toFixed(1)} km total, ${c.medianLengthM} m median`,
  );
  console.log(
    `  heightmap           ${dem.width}x${dem.height} at z${resort.zoom}, ${metresPerPixel(resort.lat, resort.zoom).toFixed(1)} m/px`,
  );
  console.log(
    `  satellite           ${imagery.width}x${imagery.height} at z${range.z + IMAGERY_ZOOM_OFFSET}`,
  );

  const placeKinds = Object.entries(m.byPlaceKind)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${n}`)
    .join(", ");

  console.log(`  lifts               ${m.lifts} (${m.aerial} aerial, ${m.surface} surface)`);
  console.log(`  named lifts         ${m.namedLifts}, up to ${m.mostWaysPerName} ways share one`);
  console.log(`  named places        ${m.places}${placeKinds ? ` — ${placeKinds}` : ""}`);

  const problems: string[] = [];
  if (c.kept < 30) problems.push(`only ${c.kept} downhill runs`);
  // Zero lifts means the area clip found nothing, not that the hill has none.
  if (m.lifts === 0) problems.push("no lifts — check that the resort polygon maps to an area");
  if (c.kept > 0 && c.named / c.kept < 0.7) problems.push(`only ${pct(c.named)} named`);
  if (c.kept > 0 && c.graded / c.kept < 0.7) problems.push(`only ${pct(c.graded)} graded`);

  if (problems.length > 0) {
    console.log(`\n  POOR COVERAGE: ${problems.join("; ")}`);
    process.exitCode = 1;
  } else {
    console.log(`\n  OK`);
  }
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

  if (args.includes("--no-cache")) disableCache();

  const checkIndex = args.indexOf("--check");
  if (checkIndex !== -1) {
    await checkResort(findResort(resorts, args[checkIndex + 1]));
    return;
  }

  if (args.includes("--all")) {
    const failures: string[] = [];
    for (const resort of resorts) {
      // Isolated per resort: one bad bake should not hide the other five.
      try {
        await bakeResort(resort);
      } catch (error) {
        failures.push(`${resort.slug}: ${error instanceof Error ? error.message : error}`);
        console.error(`  FAILED — ${error instanceof Error ? error.message : error}`);
      }
    }
    if (failures.length > 0) {
      console.error(`\n${failures.length} of ${resorts.length} resorts failed:`);
      for (const failure of failures) console.error(`  ${failure}`);
      process.exitCode = 1;
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
