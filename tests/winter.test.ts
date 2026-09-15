import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { winterize } from "@/scripts/bake/winter";

/**
 * The winter remap, checked against the landcover it was measured on.
 *
 * The reference inputs are the k-means cluster centres of Lake Louise's baked
 * drape, not values this code produced: deep conifer, conifer, open ground,
 * rock and lying snow. What is asserted is which class each one lands in, not
 * an exact colour — the constants are tuned by eye (CLAUDE.md §4) and pinning
 * them here would make every tuning pass a test failure.
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
 * A field of `ground` with a vertical stripe of `cut` down the middle — a run
 * corridor through trees, which is the shape the remap exists to draw. Probed
 * spatially because classification is: a lone pixel has no neighbourhood and so
 * cannot stand in for either class.
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
 * A field of one grey carrying a one-texel checkerboard of amplitude `amp`,
 * returning how far two neighbouring texels end up apart. Measures the stipple
 * that survives, not the mean: a checkerboard straddles the class edges, so its
 * mean legitimately moves where the transfer curves.
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
    // The whole point, and the thing a tuning pass must not quietly close: a
    // cut through the canopy has to come out clearly brighter than the trees
    // around it, or the map stops showing where the runs are.
    const { centre, edge } = corridor(CONIFER, OPEN_GROUND, 64, 8);
    expect(luminance(centre)).toBeGreaterThan(luminance(edge) * 1.35);
  });

  it("keeps deep forest darker than open forest", () => {
    expect(luminance(remap(DEEP_CONIFER))).toBeLessThan(luminance(remap(CONIFER)));
  });

  it("turns open ground into snow", () => {
    // Every meadow, clearing and run corridor is under snow in winter, and the
    // corridors reading white through dark trees is most of what this is for.
    expect(luminance(remap(OPEN_GROUND))).toBeGreaterThan(140);
  });

  it("turns lying snow white", () => {
    expect(luminance(remap(LYING_SNOW))).toBeGreaterThan(240);
  });

  it("keeps a cliff face cooler and darker than the snow beside it", () => {
    // There is no rock class: a cliff the sun was not on is dark in the
    // photograph, falls the forest side of the split and takes the same cool
    // dark tone — which is what a cliff band under snow looks like anyway.
    // What must hold is the contrast and the hue, not which branch draws it.
    const cliff = remap(ROCK);
    expect(luminance(cliff)).toBeLessThan(luminance(remap(LYING_SNOW)));
    // Cool, not warm. A warm grey reads as desert rather than as a winter
    // cliff band, which is what the first tuning pass looked like.
    expect(cliff[2]).toBeGreaterThan(cliff[0]);
  });

  it("never makes brighter ground come out darker", () => {
    // The defect this file did not catch. Keying a class on a *band* of
    // brightness is a band-pass on the very quantity being remapped, and it
    // folds the transfer back on itself — source 138 once came out 91 levels
    // brighter than source 169. The fold is not an abstraction: it draws a grey
    // rim around every snow patch, because crossing a patch edge sweeps
    // brightness through the notch.
    //
    // Probed as a gradient image rather than as separate greys, because the
    // remap reads a pixel's neighbourhood: a ramp is where a fold shows up.
    const ramp = greyRamp();
    for (let x = 1; x < ramp.length; x++) {
      expect(ramp[x]).toBeGreaterThanOrEqual(ramp[x - 1]);
    }
  });

  it("does not mistake one-texel stipple for canopy", () => {
    // Esri's tiles are JPEG, so the finest scale in the mosaic is compression,
    // not ground. Classified off that scale, flat forest came out as
    // salt-and-pepper dither rather than as crowns — measured over Lake Louise,
    // local variation in the forest band ran 20.6 and is now 8.4.
    //
    // Probed in dense forest at the amplitude a quality-82 JPEG actually
    // produces. The stipple went through at 45.8 before the canopy was
    // classified off a blurred plane instead of the raw one.
    expect(speckleSurviving(60, 12)).toBeLessThan(12);
  });

  it("never returns true black", () => {
    // SPEC's palette rule: the ground is shadowed snow, never black. Pure black
    // input is the worst case and the one a JPEG edge will actually produce.
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
 * The §8 rule, tested as one.
 *
 * SPEC §8 allows slope data on marked runs and forbids it on open terrain:
 * "here is every steep slope on the mountain" is an avalanche terrain product.
 * A drape whose snow line were keyed on steepness would be exactly that, and
 * the heightmap is in scope at the call site (scripts/bake.ts), so nothing but
 * a test stops it being reached for. Both checks below fail if it ever is.
 */
describe("SPEC §8: the remap reads the photograph and nothing else", () => {
  it("gives one colour one answer, everywhere in the frame", () => {
    // Terrain derivatives vary with position and a colour does not. The remap
    // smooths before it classifies, so it reads a pixel's neighbours — but over
    // a field with no variation in it, every position must still agree. A slope
    // would disagree, because a real mountain's does.
    for (const colour of [DEEP_CONIFER, OPEN_GROUND, ROCK, LYING_SNOW]) {
      const out = winterize(field(colour, 24, 24), 24, 24);
      const first = [...out.subarray(0, 3)];
      for (let p = 0; p < 24 * 24; p++) {
        expect([...out.subarray(p * 3, p * 3 + 3)]).toEqual(first);
      }
    }
  });

  it("is given image data and no way to ask for anything else", () => {
    // Pixels, a width and a height. There is no fourth argument for a Grid to
    // arrive through, which is the enforcement that outlasts any assertion.
    expect(winterize).toHaveLength(3);
  });

  it("takes no terrain input", async () => {
    // The negative-assertion form used for the downhill filter in
    // tests/overpass.test.ts: name what must not appear, so adding it fails.
    // Comments are stripped first — the module's own prose explains at length
    // why it does not read the heightmap, and that sentence is not a reach for
    // one.
    const source = await readFile(new URL("../scripts/bake/winter.ts", import.meta.url), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

    expect(code).not.toMatch(/heightmap|elevation|slope|aspect|terrain|Grid/i);
  });
});
