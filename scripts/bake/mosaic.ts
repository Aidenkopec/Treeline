import sharp from "sharp";
import { cachedFetch } from "./cache";
import { mosaicSize, TILE_SIZE, tilesInRange, type TileRange } from "./tiles";

/**
 * Downloading and stitching XYZ tiles. Terrarium elevation and Esri imagery are both 256px
 * tiles on one grid, which is why a single module serves both. Build time only: this is
 * the slow part SPEC §5.1 exists to keep out of a request.
 */

export interface Mosaic {
  /** Raw pixels, row-major, three channels. */
  data: Buffer;
  width: number;
  height: number;
}

export type TileUrl = (x: number, y: number, z: number) => string;

const CONCURRENCY = 6;

/**
 * Composite already-downloaded tiles into one image. Takes buffers rather than URLs so the
 * placement arithmetic, which silently transposes a mosaic when it is wrong, is testable
 * without a network. `tiles` must be in `tilesInRange` order.
 */
export async function stitchTiles(range: TileRange, tiles: Buffer[]): Promise<Mosaic> {
  const { width, height } = mosaicSize(range);
  const composite = tilesInRange(range).map((tile, i) => ({
    input: tiles[i],
    left: (tile.x - range.minX) * TILE_SIZE,
    top: (tile.y - range.minY) * TILE_SIZE,
  }));

  const { data } = await sharp({
    create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite(composite)
    // Drop the PNG alpha so `data` is three bytes per pixel, which both consumers expect.
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return { data, width, height };
}

/** Download every tile covering `range` and stitch them into one image. */
export async function fetchMosaic(range: TileRange, tileUrl: TileUrl): Promise<Mosaic> {
  const tiles = tilesInRange(range);
  const bodies = new Array<Buffer>(tiles.length);

  let next = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, tiles.length) }, async () => {
    while (next < tiles.length) {
      const i = next++;
      const { x, y, z } = tiles[i];
      bodies[i] = await cachedFetch(tileUrl(x, y, z));
    }
  });
  await Promise.all(workers);

  return stitchTiles(range, bodies);
}
