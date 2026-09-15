import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { decodeHeightmap } from "@/lib/elevation";
import { terrainGeometry } from "@/lib/terrain-mesh";
import { encodeHeightmap } from "@/scripts/bake/emit";
import type { Grid } from "@/scripts/bake/terrain";
import type { Resort } from "@/lib/types";

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
