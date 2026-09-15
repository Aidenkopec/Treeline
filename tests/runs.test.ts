import { describe, expect, it } from "vitest";
import {
  averagePitch,
  deriveRun,
  meanBearing,
  meanAspect,
  sampleProfile,
  sustainedMaxPitch,
} from "@/scripts/bake/runs";
import type { Grid } from "@/scripts/bake/terrain";
import { metresPerPixel, mosaicSize, tileRangeForBounds, tileToLonLat } from "@/scripts/bake/tiles";
import type { OverpassWay } from "@/scripts/bake/overpass";
import type { ProfileSample } from "@/lib/types";

/**
 * Synthetic terrain with answers known by construction, wired through a real
 * TileRange so the lon/lat → pixel path is the one the bake actually uses.
 * A grid falling `gradient` metres per metre toward the south faces due south.
 */
const BOUNDS = { west: -116.19, south: 51.43, east: -116.06, north: 51.48 };
const ZOOM = 13;
const RANGE = tileRangeForBounds(BOUNDS, ZOOM);
const CELL = metresPerPixel(51.4419, ZOOM);

function southFacingPlane(gradient: number): Grid {
  const { width, height } = mosaicSize(RANGE);
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    // y increases southward, so elevation must fall as y grows.
    for (let x = 0; x < width; x++) data[y * width + x] = 3000 - y * CELL * gradient;
  }
  return { data, width, height, cellSize: CELL };
}

function flatGrid(): Grid {
  const { width, height } = mosaicSize(RANGE);
  return { data: new Float32Array(width * height).fill(2000), width, height, cellSize: CELL };
}

/** A way running due south down the middle of the mosaic. */
function southwardWay(id: number, metres: number, reversed = false): OverpassWay {
  const top = tileToLonLat(RANGE.minX, RANGE.minY, ZOOM);
  const lon = top.lon + 0.02;
  const startLat = top.lat - 0.005;
  const endLat = startLat - metres / 111320;
  const geometry = [
    { lat: startLat, lon },
    { lat: endLat, lon },
  ];
  return {
    type: "way",
    id,
    tags: { "piste:type": "downhill" },
    geometry: reversed ? geometry.reverse() : geometry,
  };
}

const GRADIENT = Math.tan(20 * (Math.PI / 180));

describe("sampleProfile", () => {
  it("resamples to the requested ground interval", () => {
    const profile = sampleProfile(southwardWay(1, 500), southFacingPlane(GRADIENT), RANGE, 25);
    expect(profile.length).toBeGreaterThan(15);
    const steps = profile.slice(1, -1).map((p, i) => p.d - profile[i].d);
    for (const step of steps) expect(step).toBeCloseTo(25 / Math.cos(20 * (Math.PI / 180)), 0);
  });

  it("orients descending regardless of OSM digitisation direction", () => {
    const grid = southFacingPlane(GRADIENT);
    const downhill = sampleProfile(southwardWay(1, 500), grid, RANGE);
    const uphill = sampleProfile(southwardWay(2, 500, true), grid, RANGE);
    for (const profile of [downhill, uphill]) {
      expect(profile[0].d).toBe(0);
      expect(profile[0].e).toBeGreaterThan(profile[profile.length - 1].e);
    }
    expect(uphill[0].e).toBeCloseTo(downhill[0].e, 6);
  });

  it("accumulates 3D distance, so d exceeds the map distance on a slope", () => {
    const profile = sampleProfile(southwardWay(1, 500), southFacingPlane(GRADIENT), RANGE);
    expect(profile[profile.length - 1].d).toBeGreaterThan(500);
    expect(profile[profile.length - 1].d).toBeCloseTo(500 / Math.cos(20 * (Math.PI / 180)), -1);
  });

  it("returns nothing for a way that cannot form a line", () => {
    const grid = southFacingPlane(GRADIENT);
    expect(sampleProfile({ type: "way", id: 1 }, grid, RANGE)).toEqual([]);
    const degenerate: OverpassWay = {
      type: "way",
      id: 2,
      geometry: [
        { lat: 51.44, lon: -116.16 },
        { lat: 51.44, lon: -116.16 },
      ],
    };
    expect(sampleProfile(degenerate, grid, RANGE)).toEqual([]);
  });
});

describe("averagePitch", () => {
  it("recovers the slope of a tilted plane", () => {
    const profile = sampleProfile(southwardWay(1, 800), southFacingPlane(GRADIENT), RANGE);
    expect(averagePitch(profile)).toBeCloseTo(20, 1);
  });

  it("weights by segment length rather than taking an arithmetic mean", () => {
    // 900m at 0°, then 100m at 45°. Length-weighted = 6.1°, arithmetic = 22.5°.
    const profile: ProfileSample[] = [
      { d: 0, e: 1000, lon: 0, lat: 0 },
      { d: 900, e: 1000, lon: 0, lat: 0 },
      { d: 900 + Math.SQRT2 * 100, e: 900, lon: 0, lat: 0 },
    ];
    expect(averagePitch(profile)).toBeCloseTo(6.1, 1);
    expect(averagePitch(profile)).not.toBeCloseTo(22.5, 0);
  });

  it("does not let an undulating run cancel itself to flat", () => {
    const profile: ProfileSample[] = [
      { d: 0, e: 1000, lon: 0, lat: 0 },
      { d: 100, e: 950, lon: 0, lat: 0 },
      { d: 200, e: 1000, lon: 0, lat: 0 },
    ];
    expect(averagePitch(profile)).toBeGreaterThan(25);
  });
});

describe("sustainedMaxPitch", () => {
  it("dilutes a single-cell spike instead of reporting it as a cliff", () => {
    // Uniform 10° terrain with one DEM cell 5m out of place. Between adjacent
    // samples that reads as a near-vertical wall; the window must not.
    const step = 25 / Math.cos(10 * (Math.PI / 180));
    const profile: ProfileSample[] = Array.from({ length: 40 }, (_, i) => ({
      d: i * step,
      e: 2000 - i * 25 * Math.tan(10 * (Math.PI / 180)) - (i === 20 ? 5 : 0),
      lon: 0,
      lat: 0,
    }));

    let adjacent = 0;
    for (let i = 1; i < profile.length; i++) {
      const span = profile[i].d - profile[i - 1].d;
      adjacent = Math.max(
        adjacent,
        Math.asin((profile[i - 1].e - profile[i].e) / span) * (180 / Math.PI),
      );
    }
    expect(adjacent).toBeGreaterThan(20);
    expect(sustainedMaxPitch(profile, 100)).toBeLessThan(14);
    expect(sustainedMaxPitch(profile, 100)).toBeGreaterThan(9);
  });

  it("catches a genuinely sustained steep section", () => {
    const profile: ProfileSample[] = [];
    let d = 0;
    let e = 2000;
    for (let i = 0; i < 40; i++) {
      const deg = i >= 10 && i < 25 ? 40 : 8;
      const drop = 25 * Math.tan(deg * (Math.PI / 180));
      d += Math.hypot(25, drop);
      e -= drop;
      profile.push({ d, e, lon: 0, lat: 0 });
    }
    expect(sustainedMaxPitch(profile, 100)).toBeCloseTo(40, 0);
  });

  it("falls back to the whole run when it is shorter than the window", () => {
    const profile: ProfileSample[] = [
      { d: 0, e: 1000, lon: 0, lat: 0 },
      { d: Math.hypot(50, 50), e: 950, lon: 0, lat: 0 },
    ];
    expect(sustainedMaxPitch(profile, 100)).toBeCloseTo(45, 4);
  });

  it("is zero for a profile that cannot form a segment", () => {
    expect(sustainedMaxPitch([], 100)).toBe(0);
  });
});

describe("meanBearing", () => {
  it("averages either side of north to north, not south", () => {
    expect(meanBearing([350, 10])).toBeCloseTo(0, 6);
    expect(meanBearing([350, 10])).not.toBeCloseTo(180, 0);
  });

  it("averages an ordinary spread the obvious way", () => {
    expect(meanBearing([80, 100])).toBeCloseTo(90, 6);
  });

  it("is null when the vectors cancel exactly", () => {
    expect(meanBearing([0, 180])).toBeNull();
    expect(meanBearing([])).toBeNull();
  });
});

describe("meanAspect", () => {
  it("reads due south off a south-facing plane", () => {
    const grid = southFacingPlane(GRADIENT);
    const profile = sampleProfile(southwardWay(1, 800), grid, RANGE);
    expect(meanAspect(profile, grid, RANGE)).toBeCloseTo(180, 0);
  });

  it("falls back to the descent bearing on flat ground rather than reporting north", () => {
    const grid = flatGrid();
    const profile = sampleProfile(southwardWay(1, 800), grid, RANGE);
    expect(meanAspect(profile, grid, RANGE)).toBeCloseTo(180, 0);
  });
});

describe("deriveRun", () => {
  it("assembles a run whose numbers match the plane it was cut from", () => {
    const grid = southFacingPlane(GRADIENT);
    const way: OverpassWay = {
      ...southwardWay(24601, 800),
      tags: { "piste:type": "downhill", "piste:difficulty": "advanced", name: "Men's Downhill" },
    };
    const run = deriveRun(way, grid, RANGE);

    expect(run.id).toBe("24601");
    expect(run.name).toBe("Men's Downhill");
    expect(run.difficulty).toBe("advanced");
    expect(run.aspect_label).toBe("S");
    expect(run.aspect_deg).toBeCloseTo(180, 0);
    expect(run.pitch_avg_deg).toBeCloseTo(20, 0);
    expect(run.vertical_m).toBeCloseTo(800 * GRADIENT, -1);
    expect(run.length_m).toBeCloseTo(800 / Math.cos(20 * (Math.PI / 180)), -1);
  });

  it("rounds to the precision a 30m DEM supports", () => {
    const run = deriveRun(southwardWay(7, 400), southFacingPlane(GRADIENT), RANGE);
    expect(Number.isInteger(run.vertical_m)).toBe(true);
    expect(Number.isInteger(run.length_m)).toBe(true);
    expect(Number.isInteger(run.aspect_deg)).toBe(true);
    for (const sample of run.profile) {
      expect(sample.lon.toString().split(".")[1]?.length ?? 0).toBeLessThanOrEqual(6);
      expect(sample.d.toString().split(".")[1]?.length ?? 0).toBeLessThanOrEqual(1);
    }
  });

  it("reports an untagged way as untagged rather than guessing a grade", () => {
    const run = deriveRun(southwardWay(8, 400), southFacingPlane(GRADIENT), RANGE);
    expect(run.difficulty).toBeNull();
    expect(run.name).toBeNull();
  });
});
