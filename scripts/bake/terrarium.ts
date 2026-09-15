/**
 * AWS Terrain Tiles as a tile source.
 *
 * The RGB elevation encoding these tiles use lives in `lib/elevation.ts`,
 * because the app decodes our own heightmap.png with the same function.
 */

export const TERRARIUM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium";

/** URL for one terrarium tile. */
export function terrariumTileUrl(x: number, y: number, z: number): string {
  return `${TERRARIUM_URL}/${z}/${x}/${y}.png`;
}
