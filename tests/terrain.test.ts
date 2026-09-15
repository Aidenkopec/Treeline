import { describe, expect, it } from "vitest";
import { aspectDeg, elevationAt, type Grid, slopeDeg } from "@/scripts/bake/terrain";
import { aspectLabel } from "@/lib/aspect";

/**
 * Horn's method on synthetic terrain whose true slope and aspect are known by
 * construction. A tilted plane has one correct answer everywhere on it, so any
 * disagreement is the implementation's, not the data's.
 *
 * Grid convention: x increases east, y increases south (image rows run
 * north to south). Getting this backwards silently mirrors every aspect in the
 * project, which is why it is asserted here rather than assumed.
 */
function plane(options: { width: number; height: number; cellSize: number; dx: number; dy: number }): Grid {
  const { width, height, cellSize, dx, dy } = options;
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = 1000 + x * dx + y * dy;
    }
  }
  return { data, width, height, cellSize };
}

describe("slope", () => {
  it("reports 0° on flat ground", () => {
    const grid = plane({ width: 9, height: 9, cellSize: 30, dx: 0, dy: 0 });
    expect(slopeDeg(grid, 4, 4)).toBeCloseTo(0, 10);
  });

  it("reports 45° where the ground rises one metre per metre", () => {
    const grid = plane({ width: 9, height: 9, cellSize: 10, dx: 10, dy: 0 });
    expect(slopeDeg(grid, 4, 4)).toBeCloseTo(45, 10);
  });

  it("scales with cell size, not with pixel count", () => {
    // Same 10m rise per cell over 20m cells is half the gradient: atan(0.5).
    const grid = plane({ width: 9, height: 9, cellSize: 20, dx: 10, dy: 0 });
    expect(slopeDeg(grid, 4, 4)).toBeCloseTo((Math.atan(0.5) * 180) / Math.PI, 10);
  });
});

describe("aspect", () => {
  it("has no answer on flat ground", () => {
    const grid = plane({ width: 9, height: 9, cellSize: 30, dx: 0, dy: 0 });
    expect(aspectDeg(grid, 4, 4)).toBeNull();
  });

  it("faces west when the ground rises to the east", () => {
    const grid = plane({ width: 9, height: 9, cellSize: 30, dx: 10, dy: 0 });
    expect(aspectDeg(grid, 4, 4)).toBeCloseTo(270, 8);
    expect(aspectLabel(aspectDeg(grid, 4, 4)!)).toBe("W");
  });

  it("faces east when the ground rises to the west", () => {
    const grid = plane({ width: 9, height: 9, cellSize: 30, dx: -10, dy: 0 });
    expect(aspectDeg(grid, 4, 4)).toBeCloseTo(90, 8);
    expect(aspectLabel(aspectDeg(grid, 4, 4)!)).toBe("E");
  });

  it("faces south when the ground falls to the south", () => {
    const grid = plane({ width: 9, height: 9, cellSize: 30, dx: 0, dy: -10 });
    expect(aspectDeg(grid, 4, 4)).toBeCloseTo(180, 8);
    expect(aspectLabel(aspectDeg(grid, 4, 4)!)).toBe("S");
  });

  it("faces north when the ground falls to the north — the aspect that holds powder", () => {
    const grid = plane({ width: 9, height: 9, cellSize: 30, dx: 0, dy: 10 });
    expect(aspectDeg(grid, 4, 4)).toBeCloseTo(0, 8);
    expect(aspectLabel(aspectDeg(grid, 4, 4)!)).toBe("N");
  });

  it("reads the diagonals", () => {
    const ne = plane({ width: 9, height: 9, cellSize: 30, dx: -10, dy: 10 });
    expect(aspectLabel(aspectDeg(ne, 4, 4)!)).toBe("NE");

    const sw = plane({ width: 9, height: 9, cellSize: 30, dx: 10, dy: -10 });
    expect(aspectLabel(aspectDeg(sw, 4, 4)!)).toBe("SW");
  });
});

describe("elevation sampling", () => {
  it("returns cell values exactly at integer positions", () => {
    const grid = plane({ width: 9, height: 9, cellSize: 30, dx: 10, dy: 0 });
    expect(elevationAt(grid, 3, 4)).toBeCloseTo(1030, 10);
  });

  it("interpolates between cells rather than snapping to the grid", () => {
    const grid = plane({ width: 9, height: 9, cellSize: 30, dx: 10, dy: 0 });
    expect(elevationAt(grid, 3.5, 4)).toBeCloseTo(1035, 10);
  });

  it("flattens past the last cell rather than extrapolating off the mosaic", () => {
    // The edge cell holds 1080. Sampling beyond it clamps to that value instead
    // of continuing the plane to 1089 — a run whose polyline runs slightly off
    // the baked box should flatten out, not invent terrain that was never
    // downloaded.
    const grid = plane({ width: 9, height: 9, cellSize: 30, dx: 10, dy: 0 });
    expect(elevationAt(grid, 8, 0)).toBeCloseTo(1080, 10);
    expect(elevationAt(grid, 8.9, 0)).toBeCloseTo(1080, 10);
    expect(elevationAt(grid, 20, 20)).toBeCloseTo(1080, 10);
  });
});
