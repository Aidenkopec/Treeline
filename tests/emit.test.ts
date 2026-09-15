import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { encodeHeightmap, mergeResort, RESORT_BUDGET_BYTES } from "@/scripts/bake/emit";
import { decodeElevation } from "@/lib/elevation";
import type { Grid } from "@/scripts/bake/terrain";
import { metresPerPixel } from "@/scripts/bake/tiles";
import { plannedResorts, type ResortInput } from "@/lib/manifest";
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
    timezone: "UTC",
    elevation_min_m: 0,
    elevation_max_m: 1,
    width: 1,
    height: 1,
    metres_per_pixel: 11.91,
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

/**
 * The mesh scale the whole 3D scene hangs on.
 *
 * `metres_per_pixel` is the only manifest field the app cannot sanity-check for
 * itself — a wrong value renders a plausible-looking mountain at the wrong size
 * with the wrong apparent steepness. So the committed artifact is checked
 * against the tile math it was supposed to come from.
 */
describe("the committed manifest", () => {
  it("carries a metres_per_pixel matching the tile math for each resort", async () => {
    const manifest = JSON.parse(await readFile("public/resorts/manifest.json", "utf8")) as Manifest;
    const inputs = (
      JSON.parse(await readFile("resorts.json", "utf8")) as { resorts: ResortInput[] }
    ).resorts;

    expect(manifest.resorts.length).toBeGreaterThan(0);
    for (const resort of manifest.resorts) {
      const input = inputs.find((r) => r.slug === resort.slug);
      expect(input, `${resort.slug} is baked but missing from resorts.json`).toBeDefined();
      expect(resort.metres_per_pixel).toBeCloseTo(metresPerPixel(input!.lat, input!.zoom), 6);
    }
  });
});

describe("every resort's configured zone", () => {
  it("is one Intl recognises", () => {
    // lib/format.ts carries a catch for a zone Intl rejects. That guard is for
    // a name Open-Meteo chose; these six are ours and must never reach it.
    for (const { slug, timezone } of plannedResorts()) {
      const format = () =>
        new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
      expect(format, slug).not.toThrow();
    }
  });

  it("is baked into the manifest as configured", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../public/resorts/manifest.json", import.meta.url), "utf8"),
    ) as Manifest;
    const configured = new Map(plannedResorts().map((r) => [r.slug, r.timezone]));

    for (const baked of manifest.resorts) {
      expect(baked.timezone, baked.slug).toBe(configured.get(baked.slug));
    }
  });
});
