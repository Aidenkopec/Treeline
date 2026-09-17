import { aspectLabel } from "@/lib/aspect";
import type { ProfileSample, Run } from "@/lib/types";
import { aspectDeg, elevationAt, type Grid } from "./terrain";
import { lonLatToMosaicPixel, metresPerPixel, type TileRange } from "./tiles";
import { isInboundsDownhill, type OverpassWay, readDifficulty } from "./overpass";

/**
 * Turning an OSM way into the derived data of SPEC §6. This is the module that produces
 * the numbers no trail map gives you, so it is the one the golden tests point at.
 */

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

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

/** Pitch of a segment, given its 3D length and its drop. */
function pitchDeg(drop: number, distance3d: number): number {
  if (distance3d <= 0) return 0;
  return Math.asin(Math.min(1, Math.abs(drop) / distance3d)) * DEG;
}

/**
 * Mean compass bearing, averaged as unit vectors: 350° and 10° average to 0°, where the
 * arithmetic mean of the numbers is 180°. Null when the vectors cancel exactly, leaving
 * the caller to decide what "no direction" means in its context.
 */
export function meanBearing(bearings: number[]): number | null {
  let east = 0;
  let north = 0;
  for (const b of bearings) {
    east += Math.sin(b * RAD);
    north += Math.cos(b * RAD);
  }
  // Not `=== 0`: sin(180°) is 1.2e-16, so opposing bearings leave a residue atan2 trusts.
  if (Math.hypot(east, north) < 1e-9) return null;
  return (((Math.atan2(east, north) * DEG) % 360) + 360) % 360;
}

/**
 * Sample elevation along a way's polyline, resampled to a fixed ground interval rather
 * than at the raw OSM vertices: mappers place vertices where the trail bends, and uneven
 * spacing would skew the mean pitch toward whichever stretch was mapped in detail.
 */
export function sampleProfile(
  way: OverpassWay,
  grid: Grid,
  range: TileRange,
  intervalM = 25,
): ProfileSample[] {
  const vertices = (way.geometry ?? []).filter(
    (p, i, all) => i === 0 || p.lon !== all[i - 1].lon || p.lat !== all[i - 1].lat,
  );
  if (vertices.length < 2) return [];

  const elevation = ({ lon, lat }: { lon: number; lat: number }) => {
    const { px, py } = lonLatToMosaicPixel(lon, lat, range);
    return elevationAt(grid, px, py);
  };

  // `d` is distance from the top and OSM direction is arbitrary, so orient against the DEM.
  const ordered =
    elevation(vertices[0]) < elevation(vertices[vertices.length - 1])
      ? [...vertices].reverse()
      : vertices;

  const points: { lon: number; lat: number }[] = [ordered[0]];
  let carry = 0;
  for (let i = 1; i < ordered.length; i++) {
    const from = ordered[i - 1];
    const to = ordered[i];
    const segment = haversineM(from.lon, from.lat, to.lon, to.lat);
    if (segment === 0) continue;
    for (let at = intervalM - carry; at < segment; at += intervalM) {
      const t = at / segment;
      points.push({
        lon: from.lon + (to.lon - from.lon) * t,
        lat: from.lat + (to.lat - from.lat) * t,
      });
    }
    carry = (carry + segment) % intervalM;
  }
  const last = ordered[ordered.length - 1];
  const tail = points[points.length - 1];
  if (tail.lon !== last.lon || tail.lat !== last.lat) points.push(last);

  const profile: ProfileSample[] = [];
  let d = 0;
  for (let i = 0; i < points.length; i++) {
    const { lon, lat } = points[i];
    const e = elevation(points[i]);
    if (i > 0) {
      const previous = profile[i - 1];
      const ground = haversineM(previous.lon, previous.lat, lon, lat);
      d += Math.hypot(ground, e - previous.e);
    }
    profile.push({ d, e, lon, lat });
  }
  return profile;
}

/**
 * The steepest sustained pitch, over a sliding window. Windowed because a single noisy DEM
 * cell can report a cliff that is not there, and "this run hits 60°" is the kind of false
 * claim that turns a terrain fact into a dare (SPEC §6, §8).
 */
export function sustainedMaxPitch(profile: ProfileSample[], windowM = 100): number {
  if (profile.length < 2) return 0;

  const last = profile[profile.length - 1];
  let steepest = 0;
  let end = 0;
  for (let start = 0; start < profile.length; start++) {
    while (end < profile.length && profile[end].d - profile[start].d < windowM) end++;
    if (end >= profile.length) break;
    const span = profile[end].d - profile[start].d;
    steepest = Math.max(steepest, pitchDeg(profile[start].e - profile[end].e, span));
  }

  // Cumulative 3D distance, not sample indices: on a 30° pitch samples sit 29m apart in 3D.
  if (steepest === 0) return pitchDeg(profile[0].e - last.e, last.d);
  return steepest;
}

/** Mean slope across sampled segments, weighted by segment length. */
export function averagePitch(profile: ProfileSample[]): number {
  let weighted = 0;
  let total = 0;
  for (let i = 1; i < profile.length; i++) {
    const span = profile[i].d - profile[i - 1].d;
    if (span <= 0) continue;
    weighted += pitchDeg(profile[i - 1].e - profile[i].e, span) * span;
    total += span;
  }
  return total === 0 ? 0 : weighted / total;
}

/**
 * The direction a run faces overall, averaged as unit vectors rather than raw degrees: a
 * run alternating between 350° and 10° faces north, where the arithmetic mean is due south.
 */
export function meanAspect(profile: ProfileSample[], grid: Grid, range: TileRange): number {
  const bearings: number[] = [];
  for (const { lon, lat } of profile) {
    const { px, py } = lonLatToMosaicPixel(lon, lat, range);
    const deg = aspectDeg(grid, Math.round(px), Math.round(py));
    // null is flat ground; counting it as 0 would bias the aspect rose north.
    if (deg !== null) bearings.push(deg);
  }

  const mean = meanBearing(bearings);
  if (mean !== null) return mean;

  // All flat, or the aspects cancelled. `aspect_deg` is not nullable, so use top-to-bottom.
  const first = profile[0];
  const last = profile[profile.length - 1];
  if (!first || !last) return 0;
  const east = (last.lon - first.lon) * Math.cos(((first.lat + last.lat) / 2) * RAD);
  const north = last.lat - first.lat;
  return (((Math.atan2(east, north) * DEG) % 360) + 360) % 360;
}

/**
 * What `--check` reports: enough to judge whether a resort is worth baking before spending
 * the download on it (SPEC §13). Lengths here are map distance, not the 3D length a baked
 * run carries, because this runs before any elevation data has been fetched.
 */
export interface Coverage {
  ways: number;
  kept: number;
  rejected: number;
  named: number;
  graded: number;
  distinctNames: number;
  mostWaysPerName: number;
  totalLengthM: number;
  medianLengthM: number;
  byDifficulty: Record<string, number>;
}

/** Map length of a way, summed over its segments. */
function wayLengthM(way: OverpassWay): number {
  const points = way.geometry ?? [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineM(points[i - 1].lon, points[i - 1].lat, points[i].lon, points[i].lat);
  }
  return total;
}

export function summariseCoverage(elements: OverpassWay[]): Coverage {
  const kept = elements.filter(isInboundsDownhill);
  const lengths = kept.map(wayLengthM).sort((a, b) => a - b);
  const names = new Map<string, number>();
  const byDifficulty: Record<string, number> = {};

  for (const way of kept) {
    const name = way.tags?.name;
    if (name) names.set(name, (names.get(name) ?? 0) + 1);
    const grade = readDifficulty(way) ?? "untagged";
    byDifficulty[grade] = (byDifficulty[grade] ?? 0) + 1;
  }

  return {
    ways: elements.length,
    kept: kept.length,
    rejected: elements.length - kept.length,
    named: kept.filter((w) => w.tags?.name).length,
    graded: kept.filter((w) => readDifficulty(w) !== null).length,
    distinctNames: names.size,
    mostWaysPerName: names.size === 0 ? 0 : Math.max(...names.values()),
    totalLengthM: Math.round(lengths.reduce((a, b) => a + b, 0)),
    medianLengthM: lengths.length === 0 ? 0 : Math.round(lengths[Math.floor(lengths.length / 2)]),
    byDifficulty,
  };
}

/** Derive one complete Run from a way and the heightmap. */
export function deriveRun(way: OverpassWay, grid: Grid, range: TileRange): Run {
  const profile = sampleProfile(way, grid, range);
  const elevations = profile.map((p) => p.e);
  const aspect = profile.length > 0 ? meanAspect(profile, grid, range) : 0;
  const round1 = (n: number) => Math.round(n * 10) / 10;

  return {
    id: String(way.id),
    name: way.tags?.name ?? null,
    difficulty: readDifficulty(way),
    vertical_m:
      elevations.length === 0 ? 0 : Math.round(Math.max(...elevations) - Math.min(...elevations)),
    length_m: profile.length === 0 ? 0 : Math.round(profile[profile.length - 1].d),
    pitch_avg_deg: round1(averagePitch(profile)),
    pitch_max_deg: round1(sustainedMaxPitch(profile)),
    aspect_deg: Math.round(aspect),
    aspect_label: aspectLabel(aspect),
    profile: profile.map((p) => ({
      d: round1(p.d),
      e: round1(p.e),
      lon: Math.round(p.lon * 1e6) / 1e6,
      lat: Math.round(p.lat * 1e6) / 1e6,
    })),
  };
}

// Re-exported so the phase-1 implementation has its collaborators in one place.
export { aspectLabel, elevationAt, lonLatToMosaicPixel, metresPerPixel, readDifficulty };
