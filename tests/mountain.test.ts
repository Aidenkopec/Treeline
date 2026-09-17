import { describe, expect, it } from "vitest";
import {
  CABLE_CLEARANCE_M,
  deriveLift,
  derivePlace,
  liftTowers,
  summariseMountain,
} from "@/scripts/bake/mountain";
import {
  type OverpassPlace,
  type OverpassWay,
  placeId,
  placePoint,
  readDurationMin,
  readLiftKind,
  readPlaceKind,
} from "@/scripts/bake/overpass";
import type { Grid } from "@/scripts/bake/terrain";
import {
  lonLatToMosaicPixel,
  metresPerPixel,
  mosaicSize,
  tileRangeForBounds,
  tileToLonLat,
} from "@/scripts/bake/tiles";
import fixture from "./fixtures/overpass-mountain.json" with { type: "json" };

/**
 * Lifts and named places, which carry infrastructure facts and never terrain
 * ones. The §8 pin below is the point of this file: a lift that grew a pitch
 * field would be publishing the slope of unpatrolled ground through the side
 * door, and nothing in the type system stops that on its own.
 *
 * Synthetic terrain wired through a real TileRange, matching runs.test.ts, so
 * the lon/lat → pixel path under test is the one the bake actually uses.
 */
const BOUNDS = { west: -116.19, south: 51.43, east: -116.06, north: 51.48 };
const ZOOM = 13;
const RANGE = tileRangeForBounds(BOUNDS, ZOOM);
const CELL = metresPerPixel(51.4419, ZOOM);

const elements = fixture.elements as unknown as (OverpassWay & OverpassPlace)[];
const byId = (id: number) => elements.find((e) => e.id === id)!;

/** Ground rising `gradient` metres per metre toward the north. */
function northRisingPlane(gradient: number): Grid {
  const { width, height } = mosaicSize(RANGE);
  const data = new Float32Array(width * height);
  // y increases southward, so elevation must fall as y grows.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data[y * width + x] = 3000 - y * CELL * gradient;
  }
  return { data, width, height, cellSize: CELL };
}

/**
 * Ground that dips under a lift — a cable crossing a gully.
 *
 * A V in `y` whose vertex is put at a given latitude, so the dip is guaranteed
 * to fall *between* the lift's terminals rather than somewhere else on the
 * mosaic. That placement is the whole point: a gully outside the span proves
 * nothing about how vertical is measured across one.
 */
function gullyPlaneUnder(lat: number): Grid {
  const { width, height } = mosaicSize(RANGE);
  const data = new Float32Array(width * height);
  const vertex = lonLatToMosaicPixel(0, lat, RANGE).py;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data[y * width + x] = 2000 + Math.abs(y - vertex) * 4;
  }
  return { data, width, height, cellSize: CELL };
}

const LIFT_BOTTOM_LAT = tileToLonLat(RANGE.minX, RANGE.minY, ZOOM).lat - 0.02;

/** Half way up a lift of this length, in latitude — where a gully is put to be crossed. */
function liftMidLat(metres: number): number {
  return LIFT_BOTTOM_LAT + metres / 111320 / 2;
}

/** A lift running due north up the middle of the mosaic, with `towers` mapped nodes. */
function northwardLift(id: number, metres: number, towers: number, reversed = false): OverpassWay {
  const top = tileToLonLat(RANGE.minX, RANGE.minY, ZOOM);
  const lon = top.lon + 0.02;
  const bottomLat = LIFT_BOTTOM_LAT;
  const geometry = Array.from({ length: towers }, (_, i) => ({
    lat: bottomLat + (i / (towers - 1)) * (metres / 111320),
    lon,
  }));
  return {
    type: "way",
    id,
    tags: { aerialway: "chair_lift", name: "Test Lift" },
    geometry: reversed ? geometry.reverse() : geometry,
  };
}

const GRADIENT = Math.tan(20 * (Math.PI / 180));

describe("lift inclusion", () => {
  it("keeps a lift carrying a stale proposed:aerialway beside a real one, rather than reading the stale tag", () => {
    expect(readLiftKind(byId(1002))).toBe("chair_lift");
  });

  it("rejects a lift tagged proposed=yes, which says the lift itself is not built", () => {
    expect(readLiftKind(byId(2001))).toBeNull();
  });

  it("rejects a zip line rather than treating every aerialway as a ski lift", () => {
    expect(readLiftKind(byId(2002))).toBeNull();
  });

  it("rejects an unrenderable aerialway value rather than guessing a kind", () => {
    expect(readLiftKind(byId(2003))).toBeNull();
  });

  it("rejects the stations and pylons the aerialway filter sweeps up", () => {
    expect(readLiftKind(byId(2004))).toBeNull();
    expect(readLiftKind(byId(2005))).toBeNull();
  });

  it("keeps an unnamed chairlift, because dropping unnamed lifts would lose a real one", () => {
    expect(readLiftKind(byId(1004))).toBe("chair_lift");
  });

  it("keeps surface lifts, which are drawn on the snow rather than skipped", () => {
    expect(readLiftKind(byId(1005))).toBe("magic_carpet");
  });
});

describe("readDurationMin", () => {
  it("reads a comma decimal as five and a half rather than silently as five", () => {
    expect(readDurationMin(byId(1003))).toBe(5.5);
  });

  it("reads an ordinary decimal", () => {
    expect(readDurationMin(byId(1001))).toBe(8.5);
  });

  it("reads a missing ride time as null rather than as zero", () => {
    expect(readDurationMin(byId(1004))).toBeNull();
  });
});

describe("places", () => {
  it("calls a node that is both a summit and a cafe a peak, because the elevation is why it is mapped", () => {
    expect(readPlaceKind(byId(3003))).toBe("peak");
  });

  it("resolves a lodge mapped as a building outline through its centre", () => {
    expect(placePoint(byId(3002))).toEqual({ lat: 51.4505, lon: -116.1398 });
  });

  it("resolves a lodge mapped as a point through its own coordinates", () => {
    expect(placePoint(byId(3001))).toEqual({ lat: 51.4506, lon: -116.1399 });
  });

  it("drops a place with neither its own point nor a centre rather than placing it at zero", () => {
    expect(placePoint(byId(4002))).toBeNull();
  });

  it("is not interested in a pharmacy, however well named", () => {
    expect(readPlaceKind(byId(4003))).toBeNull();
  });

  it("gives a node and a way sharing an OSM id distinct ids rather than colliding", () => {
    const node: OverpassPlace = { type: "node", id: 123 };
    const way: OverpassPlace = { type: "way", id: 123 };
    expect(placeId(node)).not.toBe(placeId(way));
  });

  it("drops an unnamed place rather than putting a marker nobody can read on the mountain", () => {
    expect(derivePlace(byId(4001), northRisingPlane(GRADIENT), RANGE)).toBeNull();
  });

  it("drops a place off the mosaic, which is ground the bake never downloaded", () => {
    // Fernie: the query is clipped to every landuse=winter_sports polygon
    // within 8 km of the anchor, and one of them is a range away to the
    // north-west that the mosaic was never built to cover.
    const away: OverpassPlace = {
      type: "node",
      id: 5001,
      lat: BOUNDS.north + 0.2,
      lon: BOUNDS.west - 0.2,
      tags: { natural: "peak", name: "Somewhere Else" },
    };
    expect(derivePlace(away, northRisingPlane(GRADIENT), RANGE)).toBeNull();
  });

  it("reads a peak's height from OSM rather than off a DEM that resamples summits low", () => {
    const peak = derivePlace(byId(3003), northRisingPlane(GRADIENT), RANGE)!;
    expect(peak.ele_m).toBe(2637);
    // The surface height is kept beside it rather than overwritten by it: one
    // is where the marker sits, the other is what the mountain is called.
    expect(peak.surface_m).not.toBe(peak.ele_m);
  });

  it("leaves a lodge's surveyed height null, because only summits carry one", () => {
    const lodge = derivePlace(byId(3001), northRisingPlane(GRADIENT), RANGE)!;
    expect(lodge.ele_m).toBeNull();
    expect(lodge.kind).toBe("lodge");
  });
});

describe("liftTowers", () => {
  it("carries one tower per OSM node rather than a resampled polyline", () => {
    const towers = liftTowers(northwardLift(1, 900, 11), northRisingPlane(GRADIENT), RANGE);
    expect(towers).toHaveLength(11);
  });

  it("orders towers bottom to top however the way was digitised", () => {
    const grid = northRisingPlane(GRADIENT);
    const upwards = liftTowers(northwardLift(1, 900, 6), grid, RANGE);
    const downwards = liftTowers(northwardLift(1, 900, 6, true), grid, RANGE);

    expect(upwards[0].ground_m).toBeLessThan(upwards[upwards.length - 1].ground_m);
    expect(downwards[0].ground_m).toBeLessThan(downwards[downwards.length - 1].ground_m);
    expect(downwards[0].ground_m).toBeCloseTo(upwards[0].ground_m, 3);
  });

  it("holds the cable a constant height above the ground at every tower", () => {
    const towers = liftTowers(northwardLift(1, 900, 9), gullyPlaneUnder(liftMidLat(900)), RANGE);
    const clearances = towers.map((t) => t.cable_m - t.ground_m);
    for (const clearance of clearances) expect(clearance).toBeCloseTo(CABLE_CLEARANCE_M, 6);
  });

  it("returns nothing for a way with fewer than two distinct points", () => {
    const degenerate: OverpassWay = {
      type: "way",
      id: 9,
      tags: { aerialway: "chair_lift" },
      geometry: [
        { lat: 51.44, lon: -116.16 },
        { lat: 51.44, lon: -116.16 },
      ],
    };
    expect(liftTowers(degenerate, northRisingPlane(GRADIENT), RANGE)).toEqual([]);
  });
});

describe("deriveLift", () => {
  it("measures vertical terminal to terminal, so a lift over a gully does not count the dip", () => {
    const lift = deriveLift(northwardLift(1, 900, 9), gullyPlaneUnder(liftMidLat(900)), RANGE)!;
    const ground = lift.towers.map((t) => t.ground_m);
    const spread = Math.max(...ground) - Math.min(...ground);
    const terminals = Math.abs(ground[ground.length - 1] - ground[0]);

    expect(lift.vertical_m).toBe(Math.round(terminals));
    // What a run would have reported. The gap between the two is the bug this
    // rule exists to avoid: the dip is descended and climbed, not risen.
    expect(spread).toBeGreaterThan(terminals);
  });

  it("measures length along the ground, so the climb is added to the map distance", () => {
    const lift = deriveLift(northwardLift(1, 900, 4), northRisingPlane(GRADIENT), RANGE)!;

    // 900m across the map up a 20° slope is 958m travelled. Sloped ground
    // rather than flat because flat ground cannot tell this apart from the map
    // distance. The other half of the rule — that the clearance can never reach
    // this number — holds by construction and not by test: `cable_m` is
    // `ground_m` plus one constant, so both lines rise identically over every
    // segment and no terrain makes them differ.
    expect(lift.length_m).toBeGreaterThan(900);
    expect(lift.length_m).toBeCloseTo(900 / Math.cos(20 * (Math.PI / 180)), -1);
  });

  it("returns nothing for a way that is not a lift, rather than an empty lift", () => {
    expect(deriveLift(byId(2002), northRisingPlane(GRADIENT), RANGE)).toBeNull();
  });

  it("drops a lift with no tower on the mosaic, rather than hanging a cable off the sky", () => {
    const away: OverpassWay = {
      type: "way",
      id: 5002,
      tags: { aerialway: "chair_lift", name: "Somewhere Else Chair" },
      geometry: [
        { lat: BOUNDS.north + 0.2, lon: BOUNDS.west - 0.2 },
        { lat: BOUNDS.north + 0.21, lon: BOUNDS.west - 0.21 },
      ],
    };
    expect(deriveLift(away, northRisingPlane(GRADIENT), RANGE)).toBeNull();
  });

  it("carries no pitch and no aspect, which SPEC §8 attaches to marked runs only", () => {
    const lift = deriveLift(northwardLift(1, 900, 6), northRisingPlane(GRADIENT), RANGE)!;
    const keys = [...Object.keys(lift), ...lift.towers.flatMap((t) => Object.keys(t))];
    for (const key of keys) expect(key).not.toMatch(/pitch|aspect/i);
  });
});

describe("summariseMountain", () => {
  it("splits lifts into the ones that hang from a cable and the ones that run on the snow", () => {
    const coverage = summariseMountain(elements, RANGE);
    expect(coverage.aerial).toBe(4);
    expect(coverage.surface).toBe(1);
  });

  it("leaves a place off the mosaic out of the count, so --check reports what a bake keeps", () => {
    const away: OverpassPlace = {
      type: "node",
      id: 5003,
      lat: BOUNDS.north + 0.2,
      lon: BOUNDS.west - 0.2,
      tags: { natural: "peak", name: "Somewhere Else" },
    };
    expect(summariseMountain([...elements, away], RANGE).places).toBe(
      summariseMountain(elements, RANGE).places,
    );
  });

  it("counts only the places that would actually be baked", () => {
    const coverage = summariseMountain(elements, RANGE);
    expect(coverage.places).toBe(4);
    expect(coverage.byPlaceKind).toEqual({ lodge: 2, peak: 1, viewpoint: 1 });
  });
});
