import type { ProfileSample, Resort, Run } from "./types";

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

/**
 * Metres of clearance between a draped polyline and the surface it follows,
 * in exaggerated space.
 *
 * The bake sampled a run's elevation bilinearly across a heightmap cell; the
 * mesh spans the same cell with two flat triangles. Inside a cell the two
 * disagree by a little, and a line laid exactly on the sampled elevation
 * submerges wherever the triangles fall below it. Tuned by eye.
 */
export const DRAPE_OFFSET_M = 8;

/** Web Mercator northing, in radians of latitude. Longitude needs no such map. */
function mercatorY(latDeg: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (latDeg * Math.PI) / 360));
}

/**
 * A geographic point as a point in the terrain mesh's metres.
 *
 * `resort.bounds` is the mosaic rectangle, so it lies on the *outer edges* of
 * the border pixels while `terrainGeometry` puts vertices at pixel *centres*.
 * The half-pixel that separates them cancels against the recentring — hence
 * `width / 2` here where the mesh uses `(width - 1) / 2`.
 *
 * `elevationM` is the bake's own sample, not a reading off the heightmap: the
 * app renders the terrain it was given and does not measure it (SPEC §5).
 */
export function lonLatToMesh(
  lon: number,
  lat: number,
  elevationM: number,
  resort: Resort,
): [number, number, number] {
  const { bounds, width, height, metres_per_pixel: mpp } = resort;
  const north = mercatorY(bounds.north);

  const fx = ((lon - bounds.west) / (bounds.east - bounds.west)) * width;
  const fy = ((north - mercatorY(lat)) / (north - mercatorY(bounds.south))) * height;

  return [
    (fx - width / 2) * mpp,
    (elevationM - resort.elevation_min_m) * resort.vertical_exaggeration + DRAPE_OFFSET_M,
    (fy - height / 2) * mpp,
  ];
}

/** A run's sampled polyline as a flat XYZ buffer, ready for line geometry. */
export function runMeshPoints(profile: ProfileSample[], resort: Resort): Float32Array {
  const points = new Float32Array(profile.length * 3);
  for (let i = 0; i < profile.length; i++) {
    const { lon, lat, e } = profile[i];
    const [x, y, z] = lonLatToMesh(lon, lat, e, resort);
    points[i * 3] = x;
    points[i * 3 + 1] = y;
    points[i * 3 + 2] = z;
  }
  return points;
}

/** Vertical field of view of the scene camera, degrees. */
export const FOV = 45;

/** Looking down on the massif from this far above the horizon frames it initially. */
export const ELEVATION_ANGLE = (28 * Math.PI) / 180;

export type TerrainExtent = Pick<TerrainGeometry, "groundWidth" | "groundDepth" | "relief">;

/** A box in mesh metres for the camera to fit, and where its middle is. */
export interface FocusExtent {
  centre: readonly [number, number, number];
  /** East-west span, metres. */
  width: number;
  /** North-south span, metres. */
  depth: number;
  /** Top of the box above its bottom, metres, after exaggeration. */
  relief: number;
}

/**
 * The box the marked runs occupy, or null when there are none to frame.
 *
 * The mosaic is cut to whole tiles and runs a long way past the pistes — at Lake
 * Louise the runs cover about a third of it, sitting west of its middle — so
 * framing the mosaic spends most of the canvas on ground with nothing drawn on
 * it. Built through `lonLatToMesh` so the box is where the lines actually land.
 *
 * This measures the drawing, not the mountain: no run statistic is computed here
 * or anywhere else in the app (SPEC §5).
 */
export function runExtent(runs: Run[], resort: Resort): FocusExtent | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const run of runs) {
    for (const { lon, lat, e } of run.profile) {
      const [x, y, z] = lonLatToMesh(lon, lat, e, resort);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
  }

  if (minX === Infinity) return null;

  return {
    centre: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
    width: maxX - minX,
    depth: maxZ - minZ,
    relief: maxY - minY,
  };
}

export interface OpeningFraming {
  /** Camera distance from the target, metres. Also sets the orbit clamps. */
  distance: number;
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}

/**
 * Where the camera starts, from the terrain's own size rather than tuned numbers.
 *
 * Seen from above the horizon the massif is not a sphere but a plate: its depth
 * foreshortens and its relief stands up, so fitting a bounding sphere instead
 * would back the camera off to roughly twice the distance it needs.
 *
 * `aspect` is width / height of the canvas. `focus` is the box to fit; without
 * one the whole mosaic is framed, aimed low so the massif sits in the frame
 * rather than the sky above it. The caller is expected to freeze the result at
 * first render — recomputing it on resize moves the orbit clamps out from under
 * a viewer who has already zoomed.
 */
export function openingFraming(
  extent: TerrainExtent,
  aspect: number,
  focus: FocusExtent | null = null,
): OpeningFraming {
  const box: FocusExtent = focus ?? {
    centre: [0, extent.relief * 0.35, 0],
    width: extent.groundWidth,
    depth: extent.groundDepth,
    relief: extent.relief,
  };

  const half = Math.tan((FOV * Math.PI) / 360);
  const onScreenHeight =
    box.depth * Math.sin(ELEVATION_ANGLE) + box.relief * Math.cos(ELEVATION_ANGLE);
  const distance = 1.3 * Math.max(onScreenHeight / (2 * half), box.width / (2 * half * aspect));

  return {
    distance,
    // Offset from the target, not from the origin: a box that is not centred on
    // the mosaic has to be looked at from beside itself, not from beside 0,0.
    position: [
      box.centre[0],
      box.centre[1] + distance * Math.sin(ELEVATION_ANGLE),
      box.centre[2] + distance * Math.cos(ELEVATION_ANGLE),
    ],
    target: box.centre,
  };
}
