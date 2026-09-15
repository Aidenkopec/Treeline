import { describe, expect, it } from "vitest";
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
