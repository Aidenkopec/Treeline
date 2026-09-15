import type { Bounds, Difficulty } from "@/lib/types";
import { cachedFetch } from "./cache";

/**
 * Overpass queries for resort bounds and marked runs.
 *
 * The `piste:type=downhill` filter is a safety rule, not a scoping preference
 * (SPEC §8). OSM also carries `backcountry` and `skitour` ways, which are
 * unpatrolled terrain; baking those would put unpatrolled runs into a site that
 * states it covers inbounds terrain. The filter is enforced twice on purpose —
 * in the query below and again in `isInboundsDownhill` — so a hand-edited
 * query or a cached response can never widen it silently.
 *
 * Overpass is slow and rate-limited. It is only ever called at bake time.
 */

export const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

/** Grades OSM uses that this project renders. Anything else is treated as untagged. */
const KNOWN_DIFFICULTIES = new Set(["easy", "intermediate", "advanced", "expert"]);

/**
 * OSM grades that are not their own mark on a North American or Japanese trail
 * map. `novice` and `easy` are both a green circle at every resort this project
 * bakes; reporting a tagged novice run as untagged would be wrong, not cautious.
 */
const GRADE_ALIASES: Record<string, string> = { novice: "easy" };

/** Query for the resort's own boundary polygon, to derive its bounding box. */
export function resortBoundsQuery(lat: number, lon: number, radiusM = 8000): string {
  return `[out:json][timeout:90];
(
  way(around:${radiusM},${lat},${lon})["landuse"="winter_sports"];
  relation(around:${radiusM},${lat},${lon})["landuse"="winter_sports"];
);
out geom;`;
}

/** Query for marked downhill runs inside a bounding box. Downhill only — see above. */
export function downhillRunsQuery(bounds: Bounds): string {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  return `[out:json][timeout:180];
(
  way(${bbox})["piste:type"="downhill"];
);
out geom;`;
}

/** A point as Overpass returns it in `out geom` output. */
export interface OverpassPoint {
  lat: number;
  lon: number;
}

/** A way as Overpass returns it, narrowed to what the bake reads. */
export interface OverpassWay {
  type: "way";
  id: number;
  tags?: Record<string, string>;
  geometry?: OverpassPoint[];
}

/** A way or relation from the bounds query. Relations carry geometry per member. */
export interface OverpassArea {
  type: "way" | "relation";
  id: number;
  geometry?: OverpassPoint[];
  members?: { geometry?: OverpassPoint[] }[];
}

/**
 * The enforcement half of the downhill-only rule.
 *
 * Rejects anything whose `piste:type` is not exactly `downhill`, including ways
 * carrying several piste types at once — a way tagged both downhill and
 * skitour is still a skitour route and does not belong here.
 */
export function isInboundsDownhill(way: OverpassWay): boolean {
  const type = way.tags?.["piste:type"];
  if (type !== "downhill") return false;

  for (const key of Object.keys(way.tags ?? {})) {
    if (key.startsWith("piste:type:") && key !== "piste:type:downhill") return false;
  }
  return true;
}

/** Read a grade from OSM tags. Untagged is a real answer, not a default. */
export function readDifficulty(way: OverpassWay): Difficulty {
  const tagged = way.tags?.["piste:difficulty"];
  const raw = tagged ? (GRADE_ALIASES[tagged] ?? tagged) : undefined;
  return raw && KNOWN_DIFFICULTIES.has(raw) ? (raw as Difficulty) : null;
}

/** Every point an area element contributes, whether it is a way or a relation. */
function areaPoints(area: OverpassArea): OverpassPoint[] {
  return area.geometry ?? (area.members ?? []).flatMap((m) => m.geometry ?? []);
}

function boundsOf(points: OverpassPoint[]): Bounds | null {
  if (points.length === 0) return null;
  const lons = points.map((p) => p.lon);
  const lats = points.map((p) => p.lat);
  return {
    west: Math.min(...lons),
    east: Math.max(...lons),
    south: Math.min(...lats),
    north: Math.max(...lats),
  };
}

function contains(bounds: Bounds, lat: number, lon: number): boolean {
  return lon >= bounds.west && lon <= bounds.east && lat >= bounds.south && lat <= bounds.north;
}

function area(bounds: Bounds): number {
  return (bounds.east - bounds.west) * (bounds.north - bounds.south);
}

/** Grow bounds to take in every point, so nothing gets clipped at the edge. */
export function unionBounds(bounds: Bounds, points: OverpassPoint[]): Bounds {
  const extra = boundsOf(points);
  if (!extra) return bounds;
  return {
    west: Math.min(bounds.west, extra.west),
    east: Math.max(bounds.east, extra.east),
    south: Math.min(bounds.south, extra.south),
    north: Math.max(bounds.north, extra.north),
  };
}

/**
 * The resort's bounding box, from the `landuse=winter_sports` areas around it.
 *
 * An 8km search can pick up a neighbouring ski area, so prefer polygons that
 * actually contain the search anchor and take the largest of those. Falling
 * back to the union of everything is better than returning nothing, but it is
 * a sign the anchor in resorts.json is off.
 */
export function boundsFromElements(
  elements: OverpassArea[],
  lat: number,
  lon: number,
): Bounds | null {
  const candidates = elements
    .map((e) => boundsOf(areaPoints(e)))
    .filter((b): b is Bounds => b !== null);
  if (candidates.length === 0) return null;

  const containing = candidates.filter((b) => contains(b, lat, lon));
  if (containing.length > 0) {
    return containing.reduce((best, b) => (area(b) > area(best) ? b : best));
  }
  return candidates.reduce((all, b) =>
    unionBounds(all, [
      { lat: b.north, lon: b.west },
      { lat: b.south, lon: b.east },
    ]),
  );
}

/** POST a query to Overpass. Build time only — never call this from a request. */
export async function runQuery<T>(query: string): Promise<{ elements: T[] }> {
  const body = new URLSearchParams({ data: query }).toString();
  const raw = await cachedFetch(OVERPASS_ENDPOINT, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return JSON.parse(raw.toString()) as { elements: T[] };
}
