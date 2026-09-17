import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { winterize } from "@/scripts/bake/winter";

/**
 * The winter remap, checked against the landcover it was measured on. The reference inputs
 * are the k-means cluster centres of Lake Louise's baked drape, not values this code
 * produced. Which class each lands in is asserted; the colours are tuned by eye.
 */

/** One pixel, which is its own neighbourhood, so the blur is a no-op on it. */
function remap(rgb: number[]): number[] {
  return [...winterize(Buffer.from(rgb), 1, 1)];
}

/** A `width` x `height` field of one colour. */
function field(rgb: number[], width: number, height: number): Buffer {
  return Buffer.from(Array.from({ length: width * height }, () => rgb).flat());
}

/**
 * A field of `ground` with a vertical stripe of `cut` down the middle: a run corridor
 * through trees. Probed spatially because classification is, and a lone pixel has no
 * neighbourhood to stand in for either class.
 */
function corridor(ground: number[], cut: number[], width: number, stripe: number) {
  const pixels = Buffer.from(field(ground, width, width));
  const from = Math.floor((width - stripe) / 2);
  for (let y = 0; y < width; y++) {
    for (let x = from; x < from + stripe; x++) {
      pixels.set(cut, (y * width + x) * 3);
    }
  }
  const out = winterize(pixels, width, width);
  const at = (x: number) => [
    ...out.subarray((width / 2) * width * 3 + x * 3, (width / 2) * width * 3 + x * 3 + 3),
  ];
  return { centre: at(Math.floor(width / 2)), edge: at(1) };
}

/** A left-to-right sweep through every grey, as one image. */
function greyRamp(width = 256, height = 16): number[] {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) pixels.fill(x, (y * width + x) * 3, (y * width + x) * 3 + 3);
  }
  const out = winterize(pixels, width, height);
  const row = height / 2;
  return Array.from({ length: width }, (_, x) =>
    luminance([...out.subarray((row * width + x) * 3, (row * width + x) * 3 + 3)]),
  );
}

/**
 * A field of one grey carrying a one-texel checkerboard of amplitude `amp`, returning how
 * far two neighbouring texels end up apart. The stipple that survives, not the mean: a
 * checkerboard straddles the class edges, so its mean legitimately moves.
 */
function speckleSurviving(level: number, amp: number, width = 48): number {
  const pixels = Buffer.alloc(width * width * 3);
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      const v = level + ((x + y) % 2 ? amp : -amp);
      pixels.fill(v, (y * width + x) * 3, (y * width + x) * 3 + 3);
    }
  }
  const out = winterize(pixels, width, width);
  const at = (x: number) => {
    const p = (width / 2) * width + x;
    return luminance([...out.subarray(p * 3, p * 3 + 3)]);
  };
  return Math.abs(at(width / 2) - at(width / 2 + 1));
}

function luminance([r, g, b]: number[]): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const DEEP_CONIFER = [39, 51, 30];
const CONIFER = [70, 79, 58];
const OPEN_GROUND = [103, 106, 85];
const ROCK = [143, 143, 124];
const LYING_SNOW = [225, 228, 220];

describe("winter surface", () => {
  it("draws a run corridor as snow through trees", () => {
    // A cut through the canopy must come out brighter than the trees, or runs stop showing.
    const { centre, edge } = corridor(CONIFER, OPEN_GROUND, 64, 8);
    expect(luminance(centre)).toBeGreaterThan(luminance(edge) * 1.35);
  });

  it("keeps deep forest darker than open forest", () => {
    expect(luminance(remap(DEEP_CONIFER))).toBeLessThan(luminance(remap(CONIFER)));
  });

  it("turns open ground into snow", () => {
    // Every meadow, clearing and run corridor is under snow in winter.
    expect(luminance(remap(OPEN_GROUND))).toBeGreaterThan(140);
  });

  it("turns lying snow white", () => {
    expect(luminance(remap(LYING_SNOW))).toBeGreaterThan(240);
  });

  it("keeps a cliff face cooler and darker than the snow beside it", () => {
    // No rock class: a shaded cliff falls the forest side, so hue and contrast are the test.
    const cliff = remap(ROCK);
    expect(luminance(cliff)).toBeLessThan(luminance(remap(LYING_SNOW)));
    // Cool, not warm: a warm grey reads as desert rather than a winter cliff band.
    expect(cliff[2]).toBeGreaterThan(cliff[0]);
  });

  it("never makes brighter ground come out darker", () => {
    // A ramp, not separate greys: the remap reads a neighbourhood, and a fold shows there.
    const ramp = greyRamp();
    for (let x = 1; x < ramp.length; x++) {
      expect(ramp[x]).toBeGreaterThanOrEqual(ramp[x - 1]);
    }
  });

  it("does not mistake one-texel stipple for canopy", () => {
    // Esri's tiles are JPEG, so the mosaic's finest scale is compression rather than ground.
    expect(speckleSurviving(60, 12)).toBeLessThan(12);
  });

  it("never returns true black", () => {
    // Pure black is the worst case, and the one a JPEG edge actually produces.
    expect(luminance(remap([0, 0, 0]))).toBeGreaterThan(24);
  });

  it("returns a byte for every byte it was given", () => {
    const source = Buffer.from([39, 51, 30, 225, 228, 220, 0, 0, 0]);
    const out = winterize(source, 3, 1);
    expect(out).toHaveLength(source.length);
    for (const value of out) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(255);
    }
  });

  it("stays in gamut across the whole colour cube", () => {
    for (let r = 0; r < 256; r += 17) {
      for (let g = 0; g < 256; g += 17) {
        for (let b = 0; b < 256; b += 17) {
          for (const value of remap([r, g, b])) {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(255);
          }
        }
      }
    }
  });
});

/**
 * The §8 rule, tested as one. A drape whose snow line were keyed on steepness would be an
 * avalanche terrain product, and the heightmap is in scope at the call site, so nothing
 * but a test stops it being reached for. Both checks below fail if it ever is.
 */
describe("SPEC §8: the remap reads the photograph and nothing else", () => {
  it("gives one colour one answer, everywhere in the frame", () => {
    // Terrain derivatives vary with position and a colour does not; over a flat field, all agree.
    for (const colour of [DEEP_CONIFER, OPEN_GROUND, ROCK, LYING_SNOW]) {
      const out = winterize(field(colour, 24, 24), 24, 24);
      const first = [...out.subarray(0, 3)];
      for (let p = 0; p < 24 * 24; p++) {
        expect([...out.subarray(p * 3, p * 3 + 3)]).toEqual(first);
      }
    }
  });

  it("is given image data and no way to ask for anything else", () => {
    // Pixels, a width and a height: no fourth argument for a Grid to arrive through.
    expect(winterize).toHaveLength(3);
  });

  it("takes no terrain input", async () => {
    // Name what must not appear, so adding it fails. Comments are stripped first.
    const source = await readFile(new URL("../scripts/bake/winter.ts", import.meta.url), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

    expect(code).not.toMatch(/heightmap|elevation|slope|aspect|terrain|Grid/i);
  });
});
