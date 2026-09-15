import type { Resort } from "./types";

/**
 * The heightmap as a mesh, in metres.
 *
 * World units are real metres so that the sun position and the first-person
 * camera (SPEC §5.2) work in the same space the terrain was measured in. X runs
 * east, Z runs south — heightmap row 0 is the north edge of the mosaic — and Y
 * is elevation above the resort's floor, stretched by `vertical_exaggeration`.
 *
 * Pure array math, kept out of the scene component so it can be tested: a wrong
 * scale here renders a plausible mountain at the wrong size, which is exactly
 * the kind of mistake a screenshot does not catch.
 */
export interface TerrainGeometry {
  /** Vertex positions, 3 per heightmap pixel. */
  positions: Float32Array;
  /** Texture coordinates into the satellite image, 2 per pixel. */
  uvs: Float32Array;
  /** Two triangles per cell. Uint32 because a mosaic exceeds 65535 vertices. */
  indices: Uint32Array;
  /** East–west extent of the mesh, metres. */
  groundWidth: number;
  /** North–south extent of the mesh, metres. */
  groundDepth: number;
  /** Highest point above the lowest, metres, after exaggeration. */
  relief: number;
}

export function terrainGeometry(elevations: Float32Array, resort: Resort): TerrainGeometry {
  const { width, height, metres_per_pixel: mpp } = resort;
  const exaggeration = resort.vertical_exaggeration;
  const floor = resort.elevation_min_m;

  const positions = new Float32Array(width * height * 3);
  const uvs = new Float32Array(width * height * 2);

  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const v = j * width + i;
      positions[v * 3] = (i - (width - 1) / 2) * mpp;
      positions[v * 3 + 1] = (elevations[v] - floor) * exaggeration;
      positions[v * 3 + 2] = (j - (height - 1) / 2) * mpp;

      // A vertex sits at a heightmap *pixel centre*, and the satellite imagery
      // is an exact 4x subdivision of the same tiles, so its pixel centres line
      // up with these. Sampling at i/(width-1) instead would stretch the
      // texture by half a pixel at each edge — invisible on the imagery, but
      // phase 3 drapes run polylines onto this surface through the same map.
      uvs[v * 2] = (i + 0.5) / width;
      uvs[v * 2 + 1] = 1 - (j + 0.5) / height;
    }
  }

  const indices = new Uint32Array((width - 1) * (height - 1) * 6);
  let n = 0;
  for (let j = 0; j < height - 1; j++) {
    for (let i = 0; i < width - 1; i++) {
      const tl = j * width + i;
      const tr = tl + 1;
      const bl = tl + width;
      const br = bl + 1;
      indices[n++] = tl;
      indices[n++] = bl;
      indices[n++] = tr;
      indices[n++] = tr;
      indices[n++] = bl;
      indices[n++] = br;
    }
  }

  return {
    positions,
    uvs,
    indices,
    groundWidth: (width - 1) * mpp,
    groundDepth: (height - 1) * mpp,
    relief: (resort.elevation_max_m - floor) * exaggeration,
  };
}
