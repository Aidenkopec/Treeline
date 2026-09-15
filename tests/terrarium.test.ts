import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { decodeElevation, decodeHeightmap, terrariumTileUrl } from "@/scripts/bake/terrarium";

/** SPEC §11 phase 1: a fixture tile decodes to known elevations. */
describe("terrarium elevation decoding", () => {
  it("decodes the encoding's zero point to -32768m", () => {
    expect(decodeElevation(0, 0, 0)).toBe(-32768);
  });

  it("decodes sea level", () => {
    // 32768 = 128 * 256, so R=128 with G and B clear is exactly 0m.
    expect(decodeElevation(128, 0, 0)).toBe(0);
  });

  it("decodes a known summit elevation", () => {
    // Lake Louise's top station sits near 2600m: 2600 + 32768 = 35368
    // 35368 = 138 * 256 + 40, so R=138, G=40, B=0.
    expect(decodeElevation(138, 40, 0)).toBe(2600);
  });

  it("carries sub-metre precision in the blue channel", () => {
    expect(decodeElevation(128, 0, 128)).toBeCloseTo(0.5, 10);
    expect(decodeElevation(128, 0, 64)).toBeCloseTo(0.25, 10);
  });

  it("decodes a buffer into a Float32Array in row-major order", () => {
    // 2x1 pixels: sea level, then 2600m.
    const pixels = new Uint8Array([128, 0, 0, 138, 40, 0]);
    const grid = decodeHeightmap(pixels, 2, 1, 3);

    expect(grid).toBeInstanceOf(Float32Array);
    expect(Array.from(grid)).toEqual([0, 2600]);
  });

  it("skips the alpha channel when given RGBA", () => {
    const pixels = new Uint8Array([128, 0, 0, 255, 138, 40, 0, 255]);
    expect(Array.from(decodeHeightmap(pixels, 2, 1, 4))).toEqual([0, 2600]);
  });

  it("builds a z/x/y tile url", () => {
    expect(terrariumTileUrl(1452, 2726, 13)).toBe(
      "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/13/1452/2726.png",
    );
  });
});

/**
 * SPEC §11 phase 1: "fixture tile decodes to known elevations". The synthetic
 * buffers above prove the arithmetic; this proves the arithmetic is pointed at
 * the right bytes of a real file.
 *
 * tests/fixtures/terrarium-13-1452-2726.png is
 * https://s3.amazonaws.com/elevation-tiles-prod/terrarium/13/1452/2726.png
 * fetched 2026-09-15. It is the tile containing the Lake Louise base area.
 */
describe("a real terrarium tile", () => {
  async function decodeFixture() {
    const file = new URL("./fixtures/terrarium-13-1452-2726.png", import.meta.url);
    const { data, info } = await sharp(await readFile(file))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { elevations: decodeHeightmap(data, info.width, info.height, 3), info };
  }

  it("decodes one elevation per pixel of a 256px tile", async () => {
    const { elevations, info } = await decodeFixture();
    expect(info.width).toBe(256);
    expect(info.height).toBe(256);
    expect(elevations.length).toBe(256 * 256);
  });

  it("spans a plausible range for the Bow Valley and the peaks above it", async () => {
    const { elevations } = await decodeFixture();
    expect(Math.min(...elevations)).toBe(1560);
    expect(Math.max(...elevations)).toBe(2070);
  });

  it("puts the resort base at its published elevation", async () => {
    // 51.4419, -116.1622 lands at pixel (170, 113) of this tile — the Lake
    // Louise base area, published at 1646m. Checked against the resort rather
    // than against this pipeline's own output, which is the point of a fixture.
    //
    // ±20m, not ±5m: terrarium at z13 is resampled from ~30m source data, and a
    // published "base elevation" is one surveyed point rather than the mean of
    // a 12m cell. The tile reads 1652m. Asserting tighter would be claiming
    // precision the DEM does not have (SPEC §6).
    const { elevations } = await decodeFixture();
    expect(Math.abs(elevations[113 * 256 + 170] - 1646)).toBeLessThan(20);
  });
});
