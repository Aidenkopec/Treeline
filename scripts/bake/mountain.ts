import type { Lift, LiftTower, Place } from "@/lib/types";
import { elevationAt, type Grid } from "./terrain";
import { lonLatToMosaicPixel, type TileRange } from "./tiles";
import {
  type OverpassPlace,
  type OverpassWay,
  placeId,
  placePoint,
  readDurationMin,
  readLiftKind,
  readOccupancy,
  readPlaceKind,
} from "./overpass";
import { haversineM } from "./runs";

/**
 * Turning OSM lifts and named places into what the scene draws.
 *
 * The sibling of `runs.ts`, and deliberately not part of it: a run is measured
 * terrain and a lift is infrastructure, and the two carry different numbers for
 * reasons SPEC §8 is explicit about. Nothing in this file computes pitch or
 * aspect, and nothing in it may start to.
 */

/**
 * How far the cable rides above the ground, metres, before exaggeration.
 *
 * A single constant rather than a per-span fit, which is the same answer
 * `DRAPE_OFFSET_M` gives for run lines and for the same reason: it is a height
 * chosen to draw with. Fitting each tower to clear the ground under its own
 * span would make the clearance vary along a lift, and a length accumulated
 * over a varying cable is no longer a length measured on the ground — which is
 * how a rendering constant would end up inside a published number.
 *
 * Real pylons run 5–25m. Twelve reads as a lift at every zoom the camera
 * reaches without making a gondola look like it is on stilts.
 */
export const CABLE_CLEARANCE_M = 12;

/** Elevation at a point, read off the baked grid. */
function elevationReader(grid: Grid, range: TileRange) {
  return ({ lon, lat }: { lon: number; lat: number }) => {
    const { px, py } = lonLatToMosaicPixel(lon, lat, range);
    return elevationAt(grid, px, py);
  };
}

/**
 * A lift's pylons, bottom to top.
 *
 * The OSM nodes are kept exactly as mapped. This is the opposite of what
 * `sampleProfile` does to a run, and the difference matters: a run's vertices
 * sit wherever the trail bends, so resampling them is what makes its pitch
 * honest, while a lift's vertices are the surveyed tower positions. Resampling
 * here would throw away the only thing the geometry knows.
 */
export function liftTowers(way: OverpassWay, grid: Grid, range: TileRange): LiftTower[] {
  const vertices = (way.geometry ?? []).filter(
    (p, i, all) => i === 0 || p.lon !== all[i - 1].lon || p.lat !== all[i - 1].lat,
  );
  if (vertices.length < 2) return [];

  const elevation = elevationReader(grid, range);

  // Bottom first. OSM digitisation direction is arbitrary, and a lift reads
  // base-to-summit everywhere it is presented.
  const ordered =
    elevation(vertices[0]) > elevation(vertices[vertices.length - 1])
      ? [...vertices].reverse()
      : vertices;

  return ordered.map(({ lon, lat }) => {
    const ground_m = elevation({ lon, lat });
    return { lon, lat, ground_m, cable_m: ground_m + CABLE_CLEARANCE_M };
  });
}

/** 3D length along the ground beneath a line of towers, metres. */
function groundLengthM(towers: LiftTower[]): number {
  let total = 0;
  for (let i = 1; i < towers.length; i++) {
    const previous = towers[i - 1];
    const tower = towers[i];
    const ground = haversineM(previous.lon, previous.lat, tower.lon, tower.lat);
    total += Math.hypot(ground, tower.ground_m - previous.ground_m);
  }
  return total;
}

/**
 * One complete lift, or null when the way is not a lift this project draws.
 *
 * Every published number here is taken off `ground_m`. `cable_m` exists only to
 * be drawn with, and keeping it out of the arithmetic is what makes
 * `CABLE_CLEARANCE_M` unable to reach the page.
 */
export function deriveLift(way: OverpassWay, grid: Grid, range: TileRange): Lift | null {
  const kind = readLiftKind(way);
  if (kind === null) return null;

  const towers = liftTowers(way, grid, range);
  if (towers.length < 2) return null;

  const round1 = (n: number) => Math.round(n * 10) / 10;
  const bottom = towers[0];
  const top = towers[towers.length - 1];

  return {
    id: String(way.id),
    name: way.tags?.name ?? null,
    kind,
    // Terminal to terminal, not max−min: a lift that dips across a gully on the
    // way up has not climbed the dip twice.
    vertical_m: Math.round(Math.abs(top.ground_m - bottom.ground_m)),
    length_m: Math.round(groundLengthM(towers)),
    duration_min: readDurationMin(way),
    occupancy: readOccupancy(way),
    towers: towers.map((t) => ({
      lon: Math.round(t.lon * 1e6) / 1e6,
      lat: Math.round(t.lat * 1e6) / 1e6,
      ground_m: round1(t.ground_m),
      cable_m: round1(t.cable_m),
    })),
  };
}

/** One named place, or null when it is unnamed, unplaceable or not a kind we draw. */
export function derivePlace(el: OverpassPlace, grid: Grid, range: TileRange): Place | null {
  const name = el.tags?.name;
  const kind = readPlaceKind(el);
  const point = placePoint(el);
  if (!name || kind === null || point === null) return null;

  const ele = Number(el.tags?.ele);

  return {
    id: placeId(el),
    name,
    kind,
    lon: Math.round(point.lon * 1e6) / 1e6,
    lat: Math.round(point.lat * 1e6) / 1e6,
    surface_m: Math.round(elevationReader(grid, range)(point) * 10) / 10,
    // Peaks only: a summit is the one place a surveyed height beats a resampled
    // one, and it is the only kind OSM reliably tags with `ele`.
    ele_m: kind === "peak" && Number.isFinite(ele) ? Math.round(ele) : null,
  };
}

/** What `--check` reports, so a resort with nothing mapped is caught before it is baked. */
export interface MountainCoverage {
  lifts: number;
  aerial: number;
  surface: number;
  namedLifts: number;
  places: number;
  byPlaceKind: Record<string, number>;
  /** Lifts sharing one name, which is how a gondola mapped in two halves shows up. */
  mostWaysPerName: number;
}

/** Aerial kinds hang from a cable; the rest run along the snow. */
const AERIAL = new Set(["gondola", "chair_lift", "cable_car", "mixed_lift"]);

export function summariseMountain(elements: (OverpassWay | OverpassPlace)[]): MountainCoverage {
  const coverage: MountainCoverage = {
    lifts: 0,
    aerial: 0,
    surface: 0,
    namedLifts: 0,
    places: 0,
    byPlaceKind: {},
    mostWaysPerName: 0,
  };
  const perName = new Map<string, number>();

  for (const el of elements) {
    const kind = readLiftKind(el);
    if (kind !== null) {
      coverage.lifts++;
      if (AERIAL.has(kind)) coverage.aerial++;
      else coverage.surface++;
      const name = el.tags?.name;
      if (name) {
        coverage.namedLifts++;
        perName.set(name, (perName.get(name) ?? 0) + 1);
      }
      continue;
    }

    // The same three conditions `derivePlace` applies, so `--check` reports
    // what would actually be baked rather than what came back. A count that
    // included places the bake then drops is the opposite of a coverage check.
    const place = readPlaceKind(el as OverpassPlace);
    if (place !== null && el.tags?.name && placePoint(el as OverpassPlace) !== null) {
      coverage.places++;
      coverage.byPlaceKind[place] = (coverage.byPlaceKind[place] ?? 0) + 1;
    }
  }

  coverage.mostWaysPerName = Math.max(0, ...perName.values());
  return coverage;
}
