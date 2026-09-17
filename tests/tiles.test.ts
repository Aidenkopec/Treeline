import { describe, expect, it } from "vitest";
import {
  lonLatToMosaicPixel,
  lonLatToTile,
  metresPerPixel,
  mosaicSize,
  tileRangeForBounds,
  tileToLonLat,
  tilesInRange,
} from "@/scripts/bake/tiles";

/**
 * SPEC §13 budgets a day for this module and asks for its own tests. The values below are
 * properties of the Web Mercator projection itself, not numbers this code produced.
 */
describe("web mercator tile math", () => {
  it("puts the world in one tile at zoom 0, clipped at the Mercator limit", () => {
    const nw = tileToLonLat(0, 0, 0);
    expect(nw.lon).toBe(-180);
    expect(nw.lat).toBeCloseTo(85.0511287798066, 10);
  });

  it("places the null island on the four-tile corner at zoom 1", () => {
    expect(lonLatToTile(0, 0, 1)).toEqual({ x: 1, y: 1, z: 1 });
  });

  it("resolves to 156543.034 m/px at the equator at zoom 0", () => {
    expect(metresPerPixel(0, 0)).toBeCloseTo(156543.034, 3);
  });

  it("halves ground resolution with each zoom level", () => {
    expect(metresPerPixel(51.44, 12) / metresPerPixel(51.44, 13)).toBeCloseTo(2, 10);
  });

  it("round-trips a tile's corner back to the same tile", () => {
    const tile = lonLatToTile(-116.1622, 51.4419, 13);
    const corner = tileToLonLat(tile.x, tile.y, 13);
    expect(lonLatToTile(corner.lon + 1e-9, corner.lat - 1e-9, 13)).toEqual(tile);
  });

  it("covers a bounding box with a complete, row-major tile grid", () => {
    const bounds = { west: -116.25, south: 51.4, east: -116.05, north: 51.5 };
    const range = tileRangeForBounds(bounds, 13);
    const tiles = tilesInRange(range);

    const columns = range.maxX - range.minX + 1;
    const rows = range.maxY - range.minY + 1;
    expect(tiles).toHaveLength(columns * rows);
    expect(mosaicSize(range)).toEqual({ width: columns * 256, height: rows * 256 });

    // Row-major: the second tile is the one to the east, not the one below.
    expect(tiles[1]).toEqual({ x: range.minX + 1, y: range.minY, z: 13 });
  });

  it("maps the mosaic's north-west corner to pixel 0,0", () => {
    const bounds = { west: -116.25, south: 51.4, east: -116.05, north: 51.5 };
    const range = tileRangeForBounds(bounds, 13);
    const corner = tileToLonLat(range.minX, range.minY, 13);
    const pixel = lonLatToMosaicPixel(corner.lon, corner.lat, range);

    expect(pixel.px).toBeCloseTo(0, 6);
    expect(pixel.py).toBeCloseTo(0, 6);
  });

  it("increases pixel x eastward and pixel y southward", () => {
    const bounds = { west: -116.25, south: 51.4, east: -116.05, north: 51.5 };
    const range = tileRangeForBounds(bounds, 13);
    const a = lonLatToMosaicPixel(-116.2, 51.48, range);
    const b = lonLatToMosaicPixel(-116.1, 51.42, range);

    expect(b.px).toBeGreaterThan(a.px);
    expect(b.py).toBeGreaterThan(a.py);
  });
});
