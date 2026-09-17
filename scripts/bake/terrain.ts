/**
 * Slope and aspect from a heightmap by Horn's method: a 3×3 weighted gradient, the
 * standard implementation GDAL and ArcGIS use (SPEC §6). Choosing the reference tools'
 * method is what makes the golden values checkable against something other than themselves.
 */

export interface Grid {
  data: Float32Array;
  width: number;
  height: number;
  /** Ground distance between adjacent cells, metres. */
  cellSize: number;
}

/** Sample a grid with edge clamping, so the 3×3 window works at the border. */
export function sampleClamped(grid: Grid, x: number, y: number): number {
  const cx = Math.min(grid.width - 1, Math.max(0, x));
  const cy = Math.min(grid.height - 1, Math.max(0, y));
  return grid.data[cy * grid.width + cx];
}

/**
 * Bilinear elevation at a fractional pixel position.
 * Run polylines land between cells; snapping to the nearest would quantise
 * every profile to the DEM grid and put stair-steps in the elevation chart.
 */
export function elevationAt(grid: Grid, px: number, py: number): number {
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const fx = px - x0;
  const fy = py - y0;

  const a = sampleClamped(grid, x0, y0);
  const b = sampleClamped(grid, x0 + 1, y0);
  const c = sampleClamped(grid, x0, y0 + 1);
  const d = sampleClamped(grid, x0 + 1, y0 + 1);

  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

/** The east-west and north-south gradient components at a cell, Horn's weights. */
export function horn(grid: Grid, x: number, y: number): { dzdx: number; dzdy: number } {
  const z1 = sampleClamped(grid, x - 1, y - 1);
  const z2 = sampleClamped(grid, x, y - 1);
  const z3 = sampleClamped(grid, x + 1, y - 1);
  const z4 = sampleClamped(grid, x - 1, y);
  const z6 = sampleClamped(grid, x + 1, y);
  const z7 = sampleClamped(grid, x - 1, y + 1);
  const z8 = sampleClamped(grid, x, y + 1);
  const z9 = sampleClamped(grid, x + 1, y + 1);

  return {
    dzdx: (z3 + 2 * z6 + z9 - (z1 + 2 * z4 + z7)) / (8 * grid.cellSize),
    dzdy: (z7 + 2 * z8 + z9 - (z1 + 2 * z2 + z3)) / (8 * grid.cellSize),
  };
}

/** Slope at a cell, in degrees from horizontal. */
export function slopeDeg(grid: Grid, x: number, y: number): number {
  const { dzdx, dzdy } = horn(grid, x, y);
  return (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
}

/**
 * Aspect at a cell: the compass bearing the slope faces, 0–360, north = 0. Null on flat
 * ground, where the question has no answer; a flat cell reported as facing north would
 * quietly bias the aspect rose.
 */
export function aspectDeg(grid: Grid, x: number, y: number): number | null {
  const { dzdx, dzdy } = horn(grid, x, y);
  if (dzdx === 0 && dzdy === 0) return null;

  // atan2 gives the downslope direction in map space; this converts to a compass bearing.
  const rad = Math.atan2(dzdy, -dzdx);
  let deg = (rad * 180) / Math.PI;
  deg = 90 - deg;
  return ((deg % 360) + 360) % 360;
}
