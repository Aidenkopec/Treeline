import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { stitchTiles } from "@/scripts/bake/mosaic";
import {
  mosaicBounds,
  mosaicSize,
  TILE_SIZE,
  tileRangeForBounds,
  tilesInRange,
  zoomedRange,
} from "@/scripts/bake/tiles";

/** A solid-colour tile, so a stitched pixel identifies which tile it came from. */
function solidTile(r: number, g: number, b: number): Promise<Buffer> {
  return sharp({
    create: { width: TILE_SIZE, height: TILE_SIZE, channels: 3, background: { r, g, b } },
  })
    .png()
    .toBuffer();
}

const RANGE = { z: 13, minX: 10, minY: 20, maxX: 12, maxY: 21 };

describe("stitchTiles", () => {
  it("produces a mosaic of the size tiles.ts predicts", async () => {
    const tiles = await Promise.all(tilesInRange(RANGE).map(() => solidTile(1, 2, 3)));
    const mosaic = await stitchTiles(RANGE, tiles);
    expect(mosaic).toMatchObject(mosaicSize(RANGE));
    expect(mosaic.data.length).toBe(mosaic.width * mosaic.height * 3);
  });

  it("places tiles row-major, not transposed", async () => {
    // Colour each tile by its index so a transposed stitch is unmissable.
    const coords = tilesInRange(RANGE);
    const tiles = await Promise.all(coords.map((_, i) => solidTile(i * 10, 0, 0)));
    const mosaic = await stitchTiles(RANGE, tiles);

    const pixelAt = (x: number, y: number) => mosaic.data[(y * mosaic.width + x) * 3];
    coords.forEach((tile, i) => {
      const x = (tile.x - RANGE.minX) * TILE_SIZE + 4;
      const y = (tile.y - RANGE.minY) * TILE_SIZE + 4;
      expect(pixelAt(x, y)).toBe(i * 10);
    });

    // The specific failure this guards: tile index 1 is east of index 0, not south.
    expect(pixelAt(TILE_SIZE + 4, 4)).toBe(10);
    expect(pixelAt(4, TILE_SIZE + 4)).toBe(30);
  });
});

describe("mosaicBounds", () => {
  it("covers at least the bounds the range was built from", () => {
    const requested = { west: -116.19, south: 51.43, east: -116.06, north: 51.48 };
    const covered = mosaicBounds(tileRangeForBounds(requested, 13));
    expect(covered.west).toBeLessThanOrEqual(requested.west);
    expect(covered.south).toBeLessThanOrEqual(requested.south);
    expect(covered.east).toBeGreaterThanOrEqual(requested.east);
    expect(covered.north).toBeGreaterThanOrEqual(requested.north);
  });
});

describe("zoomedRange", () => {
  it("covers the identical rectangle at a deeper zoom", () => {
    const range = tileRangeForBounds(
      { west: -116.19, south: 51.43, east: -116.06, north: 51.48 },
      13,
    );
    const deeper = zoomedRange(range, 2);
    const shallow = mosaicBounds(range);
    const zoomed = mosaicBounds(deeper);

    expect(deeper.z).toBe(15);
    expect(zoomed.west).toBeCloseTo(shallow.west, 9);
    expect(zoomed.east).toBeCloseTo(shallow.east, 9);
    expect(zoomed.north).toBeCloseTo(shallow.north, 9);
    expect(zoomed.south).toBeCloseTo(shallow.south, 9);
  });

  it("scales the mosaic by exactly the zoom factor", () => {
    const range = { z: 13, minX: 10, minY: 20, maxX: 12, maxY: 21 };
    const size = mosaicSize(range);
    const deeper = mosaicSize(zoomedRange(range, 2));
    expect(deeper.width).toBe(size.width * 4);
    expect(deeper.height).toBe(size.height * 4);
  });
});
