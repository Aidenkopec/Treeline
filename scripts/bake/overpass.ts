import type { Bounds, Difficulty } from "@/lib/types";

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

/** A way as Overpass returns it, narrowed to what the bake reads. */
export interface OverpassWay {
  type: "way";
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
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
  const raw = way.tags?.["piste:difficulty"];
  return raw && KNOWN_DIFFICULTIES.has(raw) ? (raw as Difficulty) : null;
}

/** POST a query to Overpass. Build time only — never call this from a request. */
export async function runQuery(_query: string): Promise<{ elements: OverpassWay[] }> {
  throw new Error("Not implemented — phase 1");
}
