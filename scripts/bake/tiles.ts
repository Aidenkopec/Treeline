import type { Bounds } from "@/lib/types";

/**
 * Web Mercator (slippy) tile math.
 *
 * Isolated in one module with its own tests because SPEC §13 names this as the
 * known-hard part of the pipeline. Everything here is pure: no network, no
 * filesystem, so it can be tested exhaustively against known reference values.
 *
 * Both tile sources this project uses — AWS terrarium elevation and Esri World
 * Imagery — are 256px XYZ tiles on the same grid, which is why one module
 * serves both.
 */

export const TILE_SIZE = 256;

export interface TileCoord {
  x: number;
  y: number;
  z: number;
}

/** Tile range covering a bounding box, inclusive on both ends. */
export interface TileRange {
  z: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Longitude/latitude to fractional tile coordinates at zoom `z`. */
export function lonLatToTileFraction(lon: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const latRad = (lat * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * n,
    y: ((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n,
  };
}

/** Longitude/latitude to the integer tile containing it. */
export function lonLatToTile(lon: number, lat: number, z: number): TileCoord {
  const { x, y } = lonLatToTileFraction(lon, lat, z);
  return { x: Math.floor(x), y: Math.floor(y), z };
}

/** North-west corner of a tile, in longitude/latitude. */
export function tileToLonLat(x: number, y: number, z: number): { lon: number; lat: number } {
  const n = 2 ** z;
  return {
    lon: (x / n) * 360 - 180,
    lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI,
  };
}

/** Every tile needed to cover `bounds` at zoom `z`. */
export function tileRangeForBounds(bounds: Bounds, z: number): TileRange {
  const nw = lonLatToTile(bounds.west, bounds.north, z);
  const se = lonLatToTile(bounds.east, bounds.south, z);
  return {
    z,
    minX: Math.min(nw.x, se.x),
    minY: Math.min(nw.y, se.y),
    maxX: Math.max(nw.x, se.x),
    maxY: Math.max(nw.y, se.y),
  };
}

/** Flat list of tiles in a range, row-major — the order they stitch in. */
export function tilesInRange(range: TileRange): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (let y = range.minY; y <= range.maxY; y++) {
    for (let x = range.minX; x <= range.maxX; x++) {
      tiles.push({ x, y, z: range.z });
    }
  }
  return tiles;
}

/** Pixel dimensions of a stitched mosaic covering `range`. */
export function mosaicSize(range: TileRange): { width: number; height: number } {
  return {
    width: (range.maxX - range.minX + 1) * TILE_SIZE,
    height: (range.maxY - range.minY + 1) * TILE_SIZE,
  };
}

/**
 * Longitude/latitude to a pixel position inside a stitched mosaic.
 *
 * This is the function that puts a run polyline in the right place on the
 * heightmap, so it is the one to suspect first when runs land in a valley they
 * do not belong to.
 */
export function lonLatToMosaicPixel(
  lon: number,
  lat: number,
  range: TileRange,
): { px: number; py: number } {
  const { x, y } = lonLatToTileFraction(lon, lat, range.z);
  return {
    px: (x - range.minX) * TILE_SIZE,
    py: (y - range.minY) * TILE_SIZE,
  };
}

/** Metres per pixel at a given latitude and zoom — sets the resolution claims we can make. */
export function metresPerPixel(lat: number, z: number): number {
  const EQUATORIAL_CIRCUMFERENCE_M = 40075016.686;
  return (EQUATORIAL_CIRCUMFERENCE_M * Math.cos((lat * Math.PI) / 180)) / (TILE_SIZE * 2 ** z);
}
