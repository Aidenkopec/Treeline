import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { encodeHeightmap, mergeResort, RESORT_BUDGET_BYTES } from "@/scripts/bake/emit";
import { decodeElevation } from "@/scripts/bake/terrarium";
import type { Grid } from "@/scripts/bake/terrain";
import type { Manifest, Resort } from "@/lib/types";

function ramp(width: number, height: number, from: number, to: number): Grid {
  const data = new Float32Array(width * height);
  for (let i = 0; i < data.length; i++) {
    data[i] = from + ((to - from) * i) / (data.length - 1);
  }
  return { data, width, height, cellSize: 11.91 };
}

describe("encodeHeightmap", () => {
  it("reports the elevation range as whole metres spanning the data", () => {
    const meta = encodeHeightmap(ramp(16, 16, 1560.4, 2826.7));
    expect(meta.elevation_min_m).toBe(1560);
    expect(meta.elevation_max_m).toBe(2827);
    expect(meta).toMatchObject({ width: 16, height: 16 });
  });

  it("round-trips through a real PNG to within a metre", async () => {
    const grid = ramp(64, 64, 1560, 2827);
    const { pixels, width, height } = encodeHeightmap(grid);

    const png = await sharp(pixels, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer();
    const back = await sharp(png).removeAlpha().raw().toBuffer();

    for (let i = 0; i < grid.data.length; i++) {
      const decoded = decodeElevation(back[i * 3], back[i * 3 + 1], back[i * 3 + 2]);
      expect(Math.abs(decoded - grid.data[i])).toBeLessThanOrEqual(0.5);
    }
  });

  it("handles a perfectly flat grid without dividing by a zero span", () => {
    const meta = encodeHeightmap(ramp(8, 8, 2000, 2000));
    expect(meta.elevation_min_m).toBe(2000);
    expect(meta.elevation_max_m).toBe(2000);
  });

  it("stays well inside the per-resort budget at Lake Louise's size", async () => {
    const { pixels, width, height } = encodeHeightmap(ramp(768, 512, 1560, 2827));
    const png = await sharp(pixels, { raw: { width, height, channels: 3 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
    expect(png.length).toBeLessThan(RESORT_BUDGET_BYTES);
  });
});

describe("mergeResort", () => {
  const resort = (slug: string): Resort => ({
    slug,
    name: slug,
    country: "Canada",
    bounds: { west: 0, south: 0, east: 1, north: 1 },
    lat: 0,
    lon: 0,
    elevation_min_m: 0,
    elevation_max_m: 1,
    width: 1,
    height: 1,
    vertical_exaggeration: 1.4,
    baked_at: "2026-09-15",
  });

  it("replaces an existing entry rather than appending a duplicate", () => {
    const manifest: Manifest = {
      generated_at: "2026-01-01",
      resorts: [resort("fernie"), resort("lake-louise")],
    };
    const next = mergeResort(manifest, { ...resort("lake-louise"), elevation_max_m: 2827 });

    expect(next.resorts).toHaveLength(2);
    expect(next.resorts.find((r) => r.slug === "lake-louise")?.elevation_max_m).toBe(2827);
  });

  it("leaves the other resorts alone and keeps slug order", () => {
    const manifest: Manifest = { generated_at: "2026-01-01", resorts: [resort("panorama")] };
    const next = mergeResort(manifest, resort("fernie"));
    expect(next.resorts.map((r) => r.slug)).toEqual(["fernie", "panorama"]);
  });
});
