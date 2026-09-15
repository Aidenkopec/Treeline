import { LIFT_STYLES } from "@/lib/mountain";
import type { Bounds, Difficulty, LiftKind, PlaceKind } from "@/lib/types";
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

const RESORT_RADIUS_M = 8000;

/**
 * The ways and relations that make up the resort itself.
 *
 * Shared so the runs mosaic and the lift clip below cannot come to disagree
 * about what "the resort" is — two copies of this would drift the first time
 * anyone touched the radius.
 */
function resortAreas(lat: number, lon: number, radiusM: number): string {
  return `  way(around:${radiusM},${lat},${lon})["landuse"="winter_sports"];
  relation(around:${radiusM},${lat},${lon})["landuse"="winter_sports"];`;
}

/** Query for the resort's own boundary polygon, to derive its bounding box. */
export function resortBoundsQuery(lat: number, lon: number, radiusM = RESORT_RADIUS_M): string {
  return `[out:json][timeout:90];
(
${resortAreas(lat, lon, radiusM)}
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

/**
 * Query for the resort's lifts and named places.
 *
 * Clipped to the `landuse=winter_sports` polygon through `map_to_area`, not to
 * the mosaic rectangle: the mosaic is cut to whole tiles and reaches down into
 * the valley, where a village's restaurants and hotels are. At Lake Louise it is
 * what keeps the Post Hotel, the railway station and the pizza place out of a
 * list of lodges on the hill.
 *
 * Two `out` statements over named sets, which is load-bearing. A single
 * `out tags center` answers with a centre point and *no* `geometry`, so the
 * pylon polyline — the whole reason the lifts are worth drawing — never
 * arrives. Lifts need `geom`; places only need a point, and `center` is what
 * gives one to a lodge mapped as a building outline.
 *
 * Separate from `downhillRunsQuery` on purpose. The downhill filter is a safety
 * rule (§8), and a query with no `piste:type` clause in it cannot widen one.
 */
export function mountainQuery(lat: number, lon: number, radiusM = RESORT_RADIUS_M): string {
  return `[out:json][timeout:180];
(
${resortAreas(lat, lon, radiusM)}
)->.resort;
.resort map_to_area -> .a;
way(area.a)["aerialway"] -> .lifts;
(
  node(area.a)["amenity"~"^(restaurant|cafe|bar)$"];
  way(area.a)["amenity"~"^(restaurant|cafe|bar)$"];
  node(area.a)["tourism"~"^(alpine_hut|wilderness_hut|chalet|viewpoint)$"];
  node(area.a)["natural"="peak"];
) -> .places;
.lifts out geom;
.places out center;`;
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

/**
 * The lift kinds this project draws. Anything else is not a lift as far as the
 * bake is concerned. Taken from the styles so the bake cannot accept a kind the
 * app has no way to draw.
 */
const LIFT_KINDS = new Set<string>(Object.keys(LIFT_STYLES));

/**
 * Read a lift kind from OSM tags, or null when this is not a lift to draw.
 *
 * Reads the plain `aerialway` tag and nothing else. A mapper who writes
 * `aerialway=chair_lift` is saying a chairlift is there now; `proposed:aerialway`
 * and `construction:aerialway` beside it describe a *future* lift on the same
 * line and are not this one — Juniper Express carries a stale `proposed:aerialway`
 * and has been running for years. `proposed=yes` is different: it says the thing
 * itself is not built, and it is the reason the Prunepicker platter is not drawn.
 *
 * Also rejects what the `["aerialway"]` filter sweeps up but nobody rides: the
 * stations and pylons that carry the tag, and a zip line, which is not a ski lift.
 */
export function readLiftKind(el: { tags?: Record<string, string> }): LiftKind | null {
  const kind = el.tags?.aerialway;
  if (kind === undefined || el.tags?.proposed === "yes") return null;
  return LIFT_KINDS.has(kind) ? (kind as LiftKind) : null;
}

/**
 * Ride time in minutes, or null when OSM does not say it readably.
 *
 * `aerialway:duration` is decimal minutes, but it is typed by hand and arrives
 * that way: this data carries `"5,5"` for five and a half. `parseFloat` reads
 * that as `5` without complaint, which is a ten percent error that looks
 * entirely plausible on screen. Null beats a believable wrong number.
 */
export function readDurationMin(el: { tags?: Record<string, string> }): number | null {
  const raw = el.tags?.["aerialway:duration"]?.replace(",", ".");
  if (raw === undefined) return null;
  const minutes = Number(raw);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

/** Riders per carrier, or null when untagged. */
export function readOccupancy(el: { tags?: Record<string, string> }): number | null {
  const seats = Number(el.tags?.["aerialway:occupancy"]);
  return Number.isInteger(seats) && seats > 0 ? seats : null;
}

/** A place as Overpass returns it: a node carries its own point, a way carries a centre. */
export interface OverpassPlace {
  type: "node" | "way";
  id: number;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  center?: OverpassPoint;
}

/**
 * Where a place is, whether OSM mapped it as a point or as a building.
 *
 * This is the only seam that knows the difference: past it, a lodge drawn as a
 * footprint and a lodge dropped as a node are the same thing.
 */
export function placePoint(el: OverpassPlace): OverpassPoint | null {
  if (el.lat !== undefined && el.lon !== undefined) return { lat: el.lat, lon: el.lon };
  return el.center ?? null;
}

/**
 * What kind of place this is, or null when it is none of them.
 *
 * Ordered, because the tags co-occur: a café on a summit is tagged both, and a
 * summit is the more useful thing to call it — the elevation is why it is on
 * the map. Read top to bottom, first match wins.
 */
export function readPlaceKind(el: OverpassPlace): PlaceKind | null {
  const tags = el.tags ?? {};
  if (tags.natural === "peak") return "peak";
  if (tags.tourism === "viewpoint") return "viewpoint";
  if (["restaurant", "cafe", "bar"].includes(tags.amenity ?? "")) return "lodge";
  if (["alpine_hut", "wilderness_hut", "chalet"].includes(tags.tourism ?? "")) return "lodge";
  return null;
}

/**
 * A place's id, namespaced by element type.
 *
 * Runs get away with a bare way id because they are all ways. Places are nodes
 * and ways at once, and the two id spaces overlap, so an unprefixed id would
 * let one place quietly stand in for another.
 */
export function placeId(el: OverpassPlace): string {
  return `${el.type[0]}${el.id}`;
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

/**
 * Whether an Overpass body is an answer at all.
 *
 * A busy Overpass replies 200 with an error rather than a status code, in two
 * shapes: an HTML page, and — worse — valid JSON carrying a `remark` and an
 * empty `elements`. The second one does not throw anywhere; it bakes a resort
 * with no runs and no lifts and looks fine doing it. An empty `elements` with
 * no remark is left alone, because an empty answer is a real answer.
 */
export function isUsableAnswer(body: Buffer): boolean {
  try {
    const parsed = JSON.parse(body.toString()) as { elements?: unknown; remark?: string };
    return Array.isArray(parsed.elements) && !/error/i.test(parsed.remark ?? "");
  } catch {
    return false;
  }
}

/** POST a query to Overpass. Build time only — never call this from a request. */
export async function runQuery<T>(query: string): Promise<{ elements: T[] }> {
  const body = new URLSearchParams({ data: query }).toString();
  const raw = await cachedFetch(
    OVERPASS_ENDPOINT,
    {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    },
    isUsableAnswer,
  );
  return JSON.parse(raw.toString()) as { elements: T[] };
}
