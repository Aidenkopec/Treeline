/**
 * The RGB elevation encoding, shared by both sides of the SPEC §5 split.
 *
 * AWS Terrain Tiles encode elevation in RGB:
 *   elevation_m = (R * 256 + G + B / 256) - 32768
 *
 * `scripts/bake/emit.ts` writes `heightmap.png` in that same encoding on
 * purpose, so one decode serves the bake reading upstream terrarium tiles and
 * the app reading our own artifact. Keeping it in one place is what stops the
 * encode and the decode drifting apart across the build/runtime boundary.
 */

/** Decode one RGB triple to metres above sea level. */
export function decodeElevation(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

/**
 * Decode a stitched RGB(A) buffer into a Float32Array of elevations.
 *
 * A Float32Array rather than a normal array because a mosaic runs to millions
 * of cells and the gradient pass in terrain.ts walks it repeatedly — SPEC §5.3
 * accepts typed arrays over numpy precisely here. `channels` is 3 for a raw
 * sharp buffer at bake time and 4 for browser `ImageData` at runtime.
 */
export function decodeHeightmap(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  channels: 3 | 4 = 3,
): Float32Array {
  const out = new Float32Array(width * height);
  for (let i = 0; i < out.length; i++) {
    const p = i * channels;
    out[i] = decodeElevation(pixels[p], pixels[p + 1], pixels[p + 2]);
  }
  return out;
}
