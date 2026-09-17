import type { ProfileSample, Resort, Run } from "./types";

/**
 * The heightmap as a mesh, in real metres, so the sun and the first-person camera work in
 * the space the terrain was measured in (SPEC §5.2). X east, Z south (heightmap row 0 is
 * the north edge), Y elevation above the floor, stretched by `vertical_exaggeration`.
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

      // Pixel centres, not corners: `i / (width - 1)` stretches the texture half a pixel.
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
 * Metres of clearance between a draped polyline and the surface, in exaggerated space.
 * The bake sampled elevation bilinearly across a cell; the mesh spans that cell with two
 * flat triangles, so a line laid on the sample submerges where the triangles fall below.
 */
export const DRAPE_OFFSET_M = 8;

/** Web Mercator northing, in radians of latitude. Longitude needs no such map. */
function mercatorY(latDeg: number): number {
  return Math.log(Math.tan(Math.PI / 4 + (latDeg * Math.PI) / 360));
}

/**
 * A geographic point in the terrain mesh's metres. `resort.bounds` lies on the outer edges
 * of the border pixels while `terrainGeometry` puts vertices at pixel centres; the half
 * pixel cancels against the recentring, hence `width / 2` where the mesh uses `(w - 1) / 2`.
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

/**
 * The mesh surface as something that can be asked a question. Reads the vertex buffer
 * `terrainGeometry` built, stride 3, so there is no second expression for an elevation.
 */
export interface Heightfield {
  /** `TerrainGeometry.positions`: mesh XYZ per heightmap pixel, row-major. */
  positions: Float32Array;
  width: number;
  height: number;
  metresPerPixel: number;
}

export function heightfield(positions: Float32Array, resort: Resort): Heightfield {
  return {
    positions,
    width: resort.width,
    height: resort.height,
    metresPerPixel: resort.metres_per_pixel,
  };
}

/** Mesh Y at a point in the mesh's XZ plane, bilinear, clamped at the edges. */
export function surfaceHeightAt(field: Heightfield, x: number, z: number): number {
  const { positions, width, height, metresPerPixel: mpp } = field;
  const fi = Math.min(width - 1, Math.max(0, x / mpp + (width - 1) / 2));
  const fj = Math.min(height - 1, Math.max(0, z / mpp + (height - 1) / 2));

  const i0 = Math.floor(fi);
  const j0 = Math.floor(fj);
  const i1 = Math.min(width - 1, i0 + 1);
  const j1 = Math.min(height - 1, j0 + 1);
  const ti = fi - i0;
  const tj = fj - j0;

  const y = (i: number, j: number) => positions[(j * width + i) * 3 + 1];
  const north = y(i0, j0) + (y(i1, j0) - y(i0, j0)) * ti;
  const south = y(i0, j1) + (y(i1, j1) - y(i0, j1)) * ti;
  return north + (south - north) * tj;
}

/**
 * How many points along the ray are tested against the ground. Forty-eight across a nine
 * kilometre massif is a reading every 190m against a 30m model, so a knife-edge arête can
 * be stepped over. A label surviving one frame it should not costs less than a readback.
 */
const LINE_OF_SIGHT_SAMPLES = 48;

/**
 * Ground this far above the ray still counts as clear, in exaggerated metres. A label
 * anchors `DRAPE_OFFSET_M` up and `surfaceHeightAt` samples half a pixel off where the
 * bake did; without the slack every label on clear ground occludes itself at the far end.
 */
const LINE_OF_SIGHT_CLEARANCE = 12;

/**
 * Whether the ground leaves `to` in view from `from`, both in mesh metres. A heightfield
 * walk rather than a raycast: the mosaic has no acceleration structure over it and this
 * runs for every label on every camera move. Same answer, and testable without a GPU.
 */
export function isVisibleFrom(
  field: Heightfield,
  from: readonly [number, number, number],
  to: readonly [number, number, number],
): boolean {
  for (let s = 1; s <= LINE_OF_SIGHT_SAMPLES; s++) {
    const t = s / LINE_OF_SIGHT_SAMPLES;
    const x = from[0] + (to[0] - from[0]) * t;
    const z = from[2] + (to[2] - from[2]) * t;
    const ray = from[1] + (to[1] - from[1]) * t;
    if (surfaceHeightAt(field, x, z) > ray + LINE_OF_SIGHT_CLEARANCE) return false;
  }
  return true;
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
 * The box the marked runs occupy, or null when there are none to frame. The mosaic is cut
 * to whole tiles and runs a long way past the pistes, so framing it spends most of the
 * canvas on empty ground. This measures the drawing, not the mountain (SPEC §5).
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

export interface Framing {
  /** Camera distance from the target, metres. Also sets the orbit clamps. */
  distance: number;
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}

/** The camera's opening azimuth: south of the massif, looking north at it. */
const SOUTH: readonly [number, number, number] = [0, 0, 1];

/**
 * How far back a box has to be seen from to fill the frame. `h` is the unit horizontal
 * direction from box to camera: the box is axis-aligned, so which side lands across the
 * screen depends on where the camera stands. `canvasAspect` is width / height; 1.3 is margin.
 */
function fitDistance(
  box: FocusExtent,
  h: readonly [number, number, number],
  elevation: number,
  canvasAspect: number,
): number {
  const across = box.width * Math.abs(h[2]) + box.depth * Math.abs(h[0]);
  const into = box.width * Math.abs(h[0]) + box.depth * Math.abs(h[2]);
  const up = into * Math.sin(elevation) + box.relief * Math.cos(elevation);

  const half = Math.tan((FOV * Math.PI) / 360);
  return 1.3 * Math.max(up / (2 * half), across / (2 * half * canvasAspect));
}

/**
 * Where the camera starts, from the terrain's own size rather than tuned numbers. Without
 * a `focus` box the whole mosaic is framed, aimed low. Freeze the result at first render:
 * recomputing on resize moves the orbit clamps out from under a viewer who has zoomed.
 */
export function openingFraming(
  extent: TerrainExtent,
  aspect: number,
  focus: FocusExtent | null = null,
): Framing {
  const box: FocusExtent = focus ?? {
    centre: [0, extent.relief * 0.35, 0],
    width: extent.groundWidth,
    depth: extent.groundDepth,
    relief: extent.relief,
  };

  const distance = fitDistance(box, SOUTH, ELEVATION_ANGLE, aspect);

  return {
    distance,
    // Offset from the target, not the origin: an off-centre box is viewed from beside itself.
    position: [
      box.centre[0],
      box.centre[1] + distance * Math.sin(ELEVATION_ANGLE),
      box.centre[2] + distance * Math.cos(ELEVATION_ANGLE),
    ],
    target: box.centre,
  };
}

/** OrbitControls' own clamps, so a framing cannot land where the controls will not hold it. */
export interface OrbitLimits {
  minDistance: number;
  maxDistance: number;
  /** Radians from straight up, matching OrbitControls' `maxPolarAngle`. */
  maxPolarAngle: number;
}

/**
 * A camera directly overhead has no azimuth left, so the face this just swung
 * to would be thrown away on arrival. Stop a little short of vertical.
 */
const MAX_ELEVATION = Math.PI / 2 - 0.05;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** The horizontal direction a slope of this aspect faces. X east, Z south. */
function aspectNormal(aspectDeg: number): readonly [number, number, number] {
  const a = (aspectDeg * Math.PI) / 180;
  return [Math.sin(a), 0, -Math.cos(a)];
}

/**
 * Where to stand to look at one run. The azimuth is kept, so a viewer who has orbited
 * keeps their view, unless the camera is behind the slope: the overlay is depth tested,
 * so a face tilted away is foreshortened and eaten by its own ridge. Then it swings round.
 */
export function focusFraming(
  box: FocusExtent,
  aspectDeg: number,
  from: { position: readonly [number, number, number]; target: readonly [number, number, number] },
  canvasAspect: number,
  limits: OrbitLimits,
): Framing {
  const offset = [0, 1, 2].map((i) => from.position[i] - from.target[i]);
  const reach = Math.hypot(offset[0], offset[1], offset[2]);
  const flat = Math.hypot(offset[0], offset[2]);

  // Straight down, or a camera on its own target: no azimuth to read, so use the opening's.
  let h: readonly [number, number, number] =
    flat > 0 ? [offset[0] / flat, 0, offset[2] / flat] : SOUTH;

  const facing = aspectNormal(aspectDeg);
  // Negative means the camera is behind the slope, looking at ground that tilts away.
  if (h[0] * facing[0] + h[2] * facing[2] <= 0) h = facing;

  const elevation = clamp(
    reach > 0 ? Math.asin(offset[1] / reach) : ELEVATION_ANGLE,
    Math.PI / 2 - limits.maxPolarAngle,
    MAX_ELEVATION,
  );

  const distance = clamp(
    fitDistance(box, h, elevation, canvasAspect),
    limits.minDistance,
    limits.maxDistance,
  );
  const flatReach = distance * Math.cos(elevation);

  return {
    distance,
    position: [
      box.centre[0] + h[0] * flatReach,
      box.centre[1] + distance * Math.sin(elevation),
      box.centre[2] + h[2] * flatReach,
    ],
    target: box.centre,
  };
}
