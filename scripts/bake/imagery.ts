import sharp from "sharp";
import { fetchMosaic } from "./mosaic";
import { type TileRange, zoomedRange } from "./tiles";
import { winterize } from "./winter";

/**
 * Esri World Imagery tiles, remapped to a winter surface and draped over the
 * terrain as the texture. Esri's mosaic is a summer scene and there is no
 * seasonal variant of it — see scripts/bake/winter.ts for what is done about it.
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

/**
 * Imagery is baked deeper than the DEM: at the elevation zoom the drape is one
 * texel per ~12m of ground, which reads as a blurry photograph rather than a
 * mountain. Two levels is 4x the linear resolution for a file the §10 budget
 * still has room for.
 */
export const IMAGERY_ZOOM_OFFSET = 2;

/**
 * Download and stitch imagery covering exactly the same rectangle as `range`.
 *
 * Alignment with the heightmap is arithmetic rather than a crop: tile (x,y,z)
 * is exactly the tiles x·2ᵏ … x·2ᵏ+2ᵏ−1 at z+k.
 */
export async function bakeSatelliteTexture(range: TileRange, quality: number): Promise<Buffer> {
  const deeper = zoomedRange(range, IMAGERY_ZOOM_OFFSET);
  const mosaic = await fetchMosaic(deeper, esriTileUrl);
  return sharp(winterize(mosaic.data, mosaic.width, mosaic.height), {
    raw: { width: mosaic.width, height: mosaic.height, channels: 3 },
  })
    .jpeg({ quality })
    .toBuffer();
}
