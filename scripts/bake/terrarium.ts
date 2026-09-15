/**
 * Terrarium elevation tile decoding.
 *
 * AWS Terrain Tiles encode elevation in RGB:
 *   elevation_m = (R * 256 + G + B / 256) - 32768
 *
 * The decode is pure and exactly specified, so it is implemented and tested
 * here. Fetching and stitching tiles is I/O and belongs to the pipeline.
 */

export const TERRARIUM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";

/** Decode one RGB triple to metres above sea level. */
export function decodeElevation(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

/**
 * Decode a stitched RGB(A) buffer into a Float32Array of elevations.
 *
 * A Float32Array rather than a normal array because a mosaic runs to millions
 * of cells and the gradient pass in terrain.ts walks it repeatedly — SPEC §5.3
 * accepts typed arrays over numpy precisely here.
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

/** URL for one terrarium tile. */
export function terrariumTileUrl(x: number, y: number, z: number): string {
  return `${TERRARIUM_URL}/${z}/${x}/${y}.png`;
}
