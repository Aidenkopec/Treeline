import { aspectLabel } from "@/lib/aspect";
import type { ProfileSample, Run } from "@/lib/types";
import { elevationAt, type Grid } from "./terrain";
import { lonLatToMosaicPixel, metresPerPixel, type TileRange } from "./tiles";
import { type OverpassWay, readDifficulty } from "./overpass";

/**
 * Turning an OSM way into the derived data of SPEC §6.
 *
 * This is the module that produces the numbers no trail map gives you, so it
 * is the one the golden tests point at.
 */

/** Great-circle distance between two points, metres. */
export function haversineM(aLon: number, aLat: number, bLon: number, bLat: number): number {
  const R = 6371008.8;
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad;
  const dLon = (bLon - aLon) * toRad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Sample elevation along a way's polyline.
 *
 * Samples are resampled to a fixed ground interval rather than using the raw
 * OSM vertices: mappers place vertices where the trail bends, which has nothing
 * to do with where the slope changes, and an uneven sample spacing would skew
 * the mean pitch toward whichever stretch happened to be mapped in detail.
 */
export function sampleProfile(
  _way: OverpassWay,
  _grid: Grid,
  _range: TileRange,
  _intervalM = 25,
): ProfileSample[] {
  throw new Error("Not implemented — phase 1");
}

/**
 * The steepest *sustained* pitch, over a sliding window.
 *
 * Windowed because a single noisy DEM cell can report a cliff that is not
 * there, and "this run hits 60°" is exactly the kind of false claim that turns
 * a terrain fact into a dare (SPEC §6, §8).
 */
export function sustainedMaxPitch(_profile: ProfileSample[], _windowM = 100): number {
  throw new Error("Not implemented — phase 1");
}

/** Mean slope across sampled segments, weighted by segment length. */
export function averagePitch(_profile: ProfileSample[]): number {
  throw new Error("Not implemented — phase 1");
}

/**
 * The direction a run faces overall.
 *
 * Averaged as unit vectors, not as raw degrees: a run alternating between 350°
 * and 10° faces north, but the arithmetic mean of those numbers is 180° — due
 * south, the opposite answer.
 */
export function meanAspect(_profile: ProfileSample[], _grid: Grid): number {
  throw new Error("Not implemented — phase 1");
}

/** Derive one complete Run from a way and the heightmap. */
export function deriveRun(_way: OverpassWay, _grid: Grid, _range: TileRange): Run {
  throw new Error("Not implemented — phase 1");
}

// Re-exported so the phase-1 implementation has its collaborators in one place.
export { aspectLabel, elevationAt, lonLatToMosaicPixel, metresPerPixel, readDifficulty };
