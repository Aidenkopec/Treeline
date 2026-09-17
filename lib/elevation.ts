/**
 * The RGB elevation encoding AWS Terrain Tiles use, shared across the SPEC §5 split.
 * `scripts/bake/emit.ts` writes `heightmap.png` in the same encoding on purpose, so
 * one decode serves the bake reading upstream tiles and the app reading our artifact.
 */

/** Decode one RGB triple to metres above sea level. */
export function decodeElevation(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

/**
 * Decode a stitched RGB(A) buffer into a Float32Array of elevations. Typed because a
 * mosaic runs to millions of cells that the gradient pass walks repeatedly. `channels`
 * is 3 for a raw sharp buffer at bake time and 4 for browser `ImageData` at runtime.
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
