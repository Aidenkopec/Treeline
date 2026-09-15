/**
 * Esri World Imagery tiles, draped over the terrain as the surface texture.
 *
 * Same XYZ grid as the elevation tiles, so scripts/bake/tiles.ts serves both.
 * Attribution is required and is rendered in components/site-footer.tsx.
 */

export const ESRI_WORLD_IMAGERY_URL =
  "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";

/** URL for one imagery tile. Note Esri orders the path z/y/x, not z/x/y. */
export function esriTileUrl(x: number, y: number, z: number): string {
  return `${ESRI_WORLD_IMAGERY_URL}/${z}/${y}/${x}`;
}

/** Download and stitch imagery tiles into a single JPEG buffer. */
export async function bakeSatelliteTexture(): Promise<Buffer> {
  throw new Error("Not implemented — phase 1");
}
