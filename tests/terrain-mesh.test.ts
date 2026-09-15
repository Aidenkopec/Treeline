import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { decodeHeightmap } from "@/lib/elevation";
import {
  DRAPE_OFFSET_M,
  ELEVATION_ANGLE,
  FOV,
  lonLatToMesh,
  openingFraming,
  runExtent,
  runMeshPoints,
  terrainGeometry,
} from "@/lib/terrain-mesh";
import { encodeHeightmap } from "@/scripts/bake/emit";
import type { Grid } from "@/scripts/bake/terrain";
import { lonLatToMosaicPixel, tileRangeForBounds } from "@/scripts/bake/tiles";
import type { Resort, Run, RunsFile } from "@/lib/types";

function resort(over: Partial<Resort> = {}): Resort {
  return {
    slug: "test",
    name: "Test",
    country: "Canada",
    bounds: { west: 0, south: 0, east: 1, north: 1 },
    lat: 51,
    lon: -116,
    elevation_min_m: 1000,
    elevation_max_m: 2000,
    width: 5,
    height: 4,
    metres_per_pixel: 10,
    vertical_exaggeration: 1,
    baked_at: "2026-09-15",
    ...over,
  };
}

function flat(width: number, height: number, elevation: number): Float32Array {
  return new Float32Array(width * height).fill(elevation);
}

describe("terrainGeometry", () => {
  it("emits one vertex per heightmap pixel and two triangles per cell", () => {
    const g = terrainGeometry(flat(5, 4, 1000), resort());
    expect(g.positions).toHaveLength(5 * 4 * 3);
    expect(g.uvs).toHaveLength(5 * 4 * 2);
    expect(g.indices).toHaveLength((5 - 1) * (4 - 1) * 6);
    expect(Math.max(...g.indices)).toBe(5 * 4 - 1);
  });

  it("spans pixel centre to pixel centre, centred on the origin", () => {
    const g = terrainGeometry(flat(5, 4, 1000), resort());
    expect(g.groundWidth).toBe(40);
    expect(g.groundDepth).toBe(30);

    const x = (v: number) => g.positions[v * 3];
    const z = (v: number) => g.positions[v * 3 + 2];
    expect(x(0)).toBe(-20);
    expect(x(4)).toBe(20);
    expect(z(0)).toBe(-15);
    expect(z(15)).toBe(15);
  });

  it("puts north at -Z, matching heightmap row 0", () => {
    const g = terrainGeometry(flat(5, 4, 1000), resort());
    const northRow = g.positions[0 * 3 + 2];
    const southRow = g.positions[15 * 3 + 2];
    expect(northRow).toBeLessThan(southRow);
  });

  it("sits a flat grid flat on the floor", () => {
    const g = terrainGeometry(flat(5, 4, 1000), resort());
    for (let v = 0; v < 20; v++) expect(g.positions[v * 3 + 1]).toBe(0);
  });

  it("scales height above the resort floor by the exaggeration", () => {
    const elevations = flat(5, 4, 1500);
    const plain = terrainGeometry(elevations, resort({ vertical_exaggeration: 1 }));
    const stretched = terrainGeometry(elevations, resort({ vertical_exaggeration: 2 }));

    expect(plain.positions[1]).toBe(500);
    expect(stretched.positions[1]).toBe(1000);
    expect(stretched.relief).toBe(2000);
  });

  it("samples the texture at pixel centres, not at the mesh edge", () => {
    const g = terrainGeometry(flat(5, 4, 1000), resort());
    expect(g.uvs[0]).toBeCloseTo(0.5 / 5);
    expect(g.uvs[1]).toBeCloseTo(1 - 0.5 / 4);
    expect(g.uvs[19 * 2]).toBeCloseTo(4.5 / 5);
    expect(g.uvs[19 * 2 + 1]).toBeCloseTo(0.5 / 4);
  });
});

/**
 * The build-time↔runtime contract, end to end.
 *
 * The bake encodes elevation into RGB and the app decodes it back out of a PNG
 * the browser hands over as RGBA. These are the only two halves of that, and
 * they live in different halves of the project (SPEC §5), so the round trip is
 * asserted rather than assumed.
 */
describe("a baked heightmap read back as a mesh", () => {
  it("reproduces the source elevations to within a metre", async () => {
    const width = 32;
    const height = 24;
    const data = new Float32Array(width * height);
    for (let i = 0; i < data.length; i++) {
      data[i] = 1560 + ((2827 - 1560) * i) / (data.length - 1);
    }
    const grid: Grid = { data, width, height, cellSize: 11.91 };

    const encoded = encodeHeightmap(grid);
    const png = await sharp(encoded.pixels, { raw: { width, height, channels: 3 } })
      .png({ compressionLevel: 9 })
      .toBuffer();

    // Four channels: this is the shape browser ImageData arrives in.
    const rgba = await sharp(png).ensureAlpha().raw().toBuffer();
    const elevations = decodeHeightmap(rgba, width, height, 4);

    const g = terrainGeometry(
      elevations,
      resort({
        width,
        height,
        elevation_min_m: encoded.elevation_min_m,
        elevation_max_m: encoded.elevation_max_m,
        metres_per_pixel: grid.cellSize,
        vertical_exaggeration: 1,
      }),
    );

    for (let v = 0; v < data.length; v++) {
      const rendered = g.positions[v * 3 + 1] + encoded.elevation_min_m;
      expect(Math.abs(rendered - data[v])).toBeLessThanOrEqual(1);
    }
  });
});

/**
 * Putting a run where it belongs on the mountain.
 *
 * The bake maps lon/lat to a mosaic pixel through `scripts/bake/tiles.ts`; the
 * app has to reach the same place from `bounds` and `width`/`height` alone,
 * because the manifest carries no tile range. Two implementations of one
 * projection is a drift risk, so the agreement is asserted rather than assumed
 * — and asserted on the real Lake Louise range, where a transposed axis or a
 * latitude treated as linear would show up.
 */
describe("lonLatToMesh", () => {
  const lakeLouise = resort({
    bounds: {
      west: -116.19140625,
      north: 51.481382896100975,
      east: -116.0595703125,
      south: 51.42661449707482,
    },
    width: 768,
    height: 512,
    metres_per_pixel: 11.91095107773933,
    elevation_min_m: 1560,
    elevation_max_m: 2827,
    vertical_exaggeration: 1.8,
  });

  it("agrees with the bake's own projection across the mosaic", () => {
    const range = tileRangeForBounds(lakeLouise.bounds, 13);
    const { width, height, metres_per_pixel: mpp } = lakeLouise;

    for (let i = 0; i <= 10; i++) {
      for (let j = 0; j <= 10; j++) {
        const lon =
          lakeLouise.bounds.west + ((lakeLouise.bounds.east - lakeLouise.bounds.west) * i) / 10;
        const lat =
          lakeLouise.bounds.north - ((lakeLouise.bounds.north - lakeLouise.bounds.south) * j) / 10;

        const { px, py } = lonLatToMosaicPixel(lon, lat, range);
        const [x, , z] = lonLatToMesh(lon, lat, 0, lakeLouise);

        expect(x).toBeCloseTo((px - width / 2) * mpp, 6);
        expect(z).toBeCloseTo((py - height / 2) * mpp, 6);
      }
    }
  });

  it("lands the mosaic corners on the mesh corners", () => {
    const { bounds, width, height, metres_per_pixel: mpp } = lakeLouise;
    const [westX, , northZ] = lonLatToMesh(bounds.west, bounds.north, 0, lakeLouise);
    const [eastX, , southZ] = lonLatToMesh(bounds.east, bounds.south, 0, lakeLouise);

    expect(westX).toBeCloseTo((-width / 2) * mpp, 6);
    expect(eastX).toBeCloseTo((width / 2) * mpp, 6);
    expect(northZ).toBeCloseTo((-height / 2) * mpp, 6);
    expect(southZ).toBeCloseTo((height / 2) * mpp, 6);
  });

  it("bows away from a latitude read as linear", () => {
    // Mid-box is where Mercator and a straight interpolation differ most. The
    // gap is small at this size, but it is the sign the projection is real.
    const { bounds } = lakeLouise;
    const midLat = (bounds.north + bounds.south) / 2;
    const [, , z] = lonLatToMesh(bounds.west, midLat, 0, lakeLouise);

    expect(z).not.toBe(0);
    expect(Math.abs(z)).toBeLessThan(lakeLouise.metres_per_pixel);
  });

  it("stands a run above the surface by the drape offset", () => {
    const { bounds, elevation_min_m, vertical_exaggeration } = lakeLouise;
    const [, y] = lonLatToMesh(bounds.west, bounds.north, elevation_min_m + 100, lakeLouise);

    expect(y).toBeCloseTo(100 * vertical_exaggeration + DRAPE_OFFSET_M, 6);
  });
});

/**
 * Every baked run, drawn on the mesh it was baked against.
 *
 * `runs.golden.test.ts` already asserts each profile point falls inside
 * `bounds`. This is the same claim one step further on: that the projection
 * turns those points into somewhere the terrain actually is.
 */
describe("the committed Lake Louise runs on the mesh", () => {
  const file: RunsFile = JSON.parse(
    readFileSync(new URL("../public/resorts/lake-louise/runs.json", import.meta.url), "utf8"),
  );
  const manifest = JSON.parse(
    readFileSync(new URL("../public/resorts/manifest.json", import.meta.url), "utf8"),
  );
  const lakeLouise: Resort = manifest.resorts.find((r: Resort) => r.slug === "lake-louise");

  it("keeps every run inside the terrain and above its floor", () => {
    const halfWidth = (lakeLouise.width / 2) * lakeLouise.metres_per_pixel;
    const halfDepth = (lakeLouise.height / 2) * lakeLouise.metres_per_pixel;

    for (const run of file.runs) {
      const points = runMeshPoints(run.profile, lakeLouise);
      expect(points).toHaveLength(run.profile.length * 3);

      for (let i = 0; i < points.length; i += 3) {
        expect(Math.abs(points[i])).toBeLessThanOrEqual(halfWidth);
        expect(Math.abs(points[i + 2])).toBeLessThanOrEqual(halfDepth);
        expect(points[i + 1]).toBeGreaterThan(0);
      }
    }
  });
});

const EXTENT = { groundWidth: 4000, groundDepth: 3000, relief: 1000 };

describe("openingFraming", () => {
  it("frames a known massif at a known distance", () => {
    // Pinned because the alternative is a screenshot, and a screenshot of a
    // mountain at the wrong distance still looks like a mountain.
    expect(openingFraming(EXTENT, 2).distance).toBeCloseTo(3595.69, 1);
  });

  it("puts the camera on the elevation-angle ray, looking at the lower third", () => {
    const { distance, position, target } = openingFraming(EXTENT, 2);
    // Measured from the target, not from the origin. Without a focus box the
    // two sit on the same vertical, but the ray has always been the one the
    // camera looks along, and a focus box moves the target off centre.
    const [x, y, z] = [0, 1, 2].map((i) => position[i] - target[i]);

    expect(position[0]).toBe(0);
    expect(Math.hypot(x, y, z)).toBeCloseTo(distance, 6);
    expect(Math.asin(y / distance)).toBeCloseTo(ELEVATION_ANGLE, 6);
    expect(z).toBeGreaterThan(0);
    expect(target).toEqual([0, 350, 0]);
  });

  it("clears the massif in both axes, with margin", () => {
    const aspect = 2;
    const { distance } = openingFraming(EXTENT, aspect);
    const half = Math.tan((FOV * Math.PI) / 360);

    const onScreenHeight =
      EXTENT.groundDepth * Math.sin(ELEVATION_ANGLE) + EXTENT.relief * Math.cos(ELEVATION_ANGLE);
    expect(distance * half).toBeGreaterThan(onScreenHeight / 2);
    expect(distance * half * aspect).toBeGreaterThan(EXTENT.groundWidth / 2);
  });

  it("backs off further as the viewport narrows", () => {
    // A portrait phone has to fit the same east-west width into less of it.
    const wide = openingFraming(EXTENT, 2).distance;
    const narrow = openingFraming(EXTENT, 0.5).distance;

    expect(narrow).toBeGreaterThan(wide);
  });
});

describe("runExtent", () => {
  const box = resort({ elevation_min_m: 0, elevation_max_m: 100 });

  function sampled(lonLatE: [number, number, number][]): Run {
    return {
      id: "r",
      name: null,
      difficulty: null,
      vertical_m: 0,
      length_m: 0,
      pitch_avg_deg: 0,
      pitch_max_deg: 0,
      aspect_deg: 0,
      aspect_label: "N",
      profile: lonLatE.map(([lon, lat, e], i) => ({ d: i, e, lon, lat })),
    };
  }

  it("has nothing to frame without runs", () => {
    expect(runExtent([], box)).toBeNull();
    expect(runExtent([sampled([])], box)).toBeNull();
  });

  it("spans the extreme samples, through the same projection that draws them", () => {
    const runs = [
      sampled([
        [0.2, 0.8, 10],
        [0.4, 0.6, 40],
      ]),
      sampled([
        [0.6, 0.4, 20],
        [0.8, 0.2, 90],
      ]),
    ];
    const extent = runExtent(runs, box)!;

    // Pinned to lonLatToMesh rather than to transcribed numbers, so a second
    // implementation of the projection cannot hide in here.
    const [westX, lowY, northZ] = lonLatToMesh(0.2, 0.8, 10, box);
    const [eastX, highY, southZ] = lonLatToMesh(0.8, 0.2, 90, box);

    expect(extent.width).toBeCloseTo(eastX - westX, 6);
    expect(extent.depth).toBeCloseTo(southZ - northZ, 6);
    expect(extent.relief).toBeCloseTo(highY - lowY, 6);
    expect(extent.centre[0]).toBeCloseTo((westX + eastX) / 2, 6);
    expect(extent.centre[1]).toBeCloseTo((lowY + highY) / 2, 6);
    expect(extent.centre[2]).toBeCloseTo((northZ + southZ) / 2, 6);
  });
});

describe("openingFraming on the committed Lake Louise runs", () => {
  const file: RunsFile = JSON.parse(
    readFileSync(new URL("../public/resorts/lake-louise/runs.json", import.meta.url), "utf8"),
  );
  const manifest = JSON.parse(
    readFileSync(new URL("../public/resorts/manifest.json", import.meta.url), "utf8"),
  );
  const lakeLouise: Resort = manifest.resorts.find((r: Resort) => r.slug === "lake-louise");
  const extent = {
    groundWidth: (lakeLouise.width - 1) * lakeLouise.metres_per_pixel,
    groundDepth: (lakeLouise.height - 1) * lakeLouise.metres_per_pixel,
    relief:
      (lakeLouise.elevation_max_m - lakeLouise.elevation_min_m) * lakeLouise.vertical_exaggeration,
  };
  const focus = runExtent(file.runs, lakeLouise)!;
  const ASPECT = 1.2;

  it("covers a fraction of the mosaic, which is the reason to frame it separately", () => {
    expect(focus.width).toBeLessThan(extent.groundWidth * 0.6);
    expect(focus.depth).toBeLessThan(extent.groundDepth * 0.8);
    // The pistes sit west of the middle of a mosaic cut to whole tiles.
    expect(focus.centre[0]).toBeLessThan(0);
  });

  it("comes closer than framing the whole mosaic does", () => {
    const whole = openingFraming(extent, ASPECT).distance;
    const runs = openingFraming(extent, ASPECT, focus).distance;

    expect(runs).toBeLessThan(whole * 0.6);
  });

  it("aims at the runs and still holds them in frame", () => {
    const { distance, position, target } = openingFraming(extent, ASPECT, focus);
    const half = Math.tan((FOV * Math.PI) / 360);
    const onScreenHeight =
      focus.depth * Math.sin(ELEVATION_ANGLE) + focus.relief * Math.cos(ELEVATION_ANGLE);

    expect(target).toEqual(focus.centre);
    expect(distance * half).toBeGreaterThan(onScreenHeight / 2);
    expect(distance * half * ASPECT).toBeGreaterThan(focus.width / 2);

    const [x, y, z] = [0, 1, 2].map((i) => position[i] - target[i]);
    expect(Math.hypot(x, y, z)).toBeCloseTo(distance, 6);
    expect(Math.asin(y / distance)).toBeCloseTo(ELEVATION_ANGLE, 6);
    expect(z).toBeGreaterThan(0);
  });

  it("keeps the camera over the terrain it is looking at", () => {
    const { position, target } = openingFraming(extent, ASPECT, focus);
    const halfWidth = (lakeLouise.width / 2) * lakeLouise.metres_per_pixel;
    const halfDepth = (lakeLouise.height / 2) * lakeLouise.metres_per_pixel;

    expect(Math.abs(target[0])).toBeLessThan(halfWidth);
    expect(Math.abs(target[2])).toBeLessThan(halfDepth);
    expect(position[1]).toBeGreaterThan(extent.relief);
  });

  it("still backs off further as the viewport narrows", () => {
    expect(openingFraming(extent, 0.5, focus).distance).toBeGreaterThan(
      openingFraming(extent, 2, focus).distance,
    );
  });
});
