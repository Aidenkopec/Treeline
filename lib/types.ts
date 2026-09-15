/**
 * The contract between build time and runtime.
 *
 * The bake pipeline emits exactly these shapes; the app reads them and renders.
 * Nothing in the app may compute a run statistic — if a number is missing here,
 * it gets added to the bake and its test, not derived in a component. That is
 * the split SPEC §5 is built on: numerical work gets automated verification,
 * visual work gets human review.
 */

/** Compass bucket a slope faces. Aspect governs sun and snow preservation. */
export type AspectLabel = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

/**
 * OSM `piste:difficulty`, narrowed to the grades that appear on marked runs.
 * `null` is a real and common value — plenty of ways are untagged, and the UI
 * says so rather than guessing a grade.
 */
export type Difficulty = "easy" | "intermediate" | "advanced" | "expert" | null;

/** One elevation sample along a run's polyline. */
export interface ProfileSample {
  /** Cumulative 3D distance from the top of the run, metres. */
  d: number;
  /** Elevation, metres. */
  e: number;
  /** Longitude, WGS84. */
  lon: number;
  /** Latitude, WGS84. */
  lat: number;
}

/**
 * A marked downhill run with its terrain derived from the DEM (SPEC §6).
 *
 * Every number here is computed, not transcribed from a trail map — that is
 * the entire point of the project.
 */
export interface Run {
  /** Stable id, derived from the OSM way id. */
  id: string;
  /** OSM `name`, or null when the way is unnamed. */
  name: string | null;
  difficulty: Difficulty;
  /** max elevation − min elevation, metres. */
  vertical_m: number;
  /** 3D path length along the surface, metres — not map distance. */
  length_m: number;
  /** Mean slope over sampled segments, degrees. */
  pitch_avg_deg: number;
  /** Steepest *sustained* segment, windowed so one noisy DEM cell cannot report a cliff. */
  pitch_max_deg: number;
  /** Compass direction the run faces, 0–360. */
  aspect_deg: number;
  aspect_label: AspectLabel;
  /** Samples along the run: drives the profile chart and the first-person camera path. */
  profile: ProfileSample[];
}

/**
 * How a lift carries its riders, from OSM `aerialway`.
 *
 * The split is not cosmetic: an aerial kind hangs from a cable and is drawn
 * held above the ground on its pylons, a surface kind is draped on the snow. A
 * magic carpet drawn twelve metres up would be a lie. Which is which is
 * `LIFT_STYLES` in `lib/mountain.ts`, not the order of this union.
 */
export type LiftKind =
  | "gondola"
  | "chair_lift"
  | "cable_car"
  | "mixed_lift"
  | "magic_carpet"
  | "platter"
  | "t-bar"
  | "rope_tow"
  | "drag_lift";

/** One mapped pylon, with the ground under it and the cable over it. */
export interface LiftTower {
  lon: number;
  lat: number;
  /** DEM elevation at the tower's foot, metres. Every published lift number is measured on this. */
  ground_m: number;
  /**
   * Elevation the cable passes through here, metres. A height chosen to draw
   * with, not a measurement — which is why nothing published is derived from it.
   */
  cable_m: number;
}

/**
 * A lift, as infrastructure.
 *
 * **No pitch, no aspect, ever (SPEC §8.)** Slope data attaches to marked runs;
 * the ground under a cable is not one, and reporting its steepness would
 * publish the angle of unpatrolled terrain through an infrastructure feature.
 * `tests/mountain.golden.test.ts` fails on any key here matching /pitch|aspect/i.
 */
export interface Lift {
  /** Stable id, derived from the OSM way id. */
  id: string;
  name: string | null;
  kind: LiftKind;
  /**
   * Top terminal minus bottom terminal, metres — the rise, measured on the
   * ground. Deliberately not max−min the way a run's is: a lift that dips
   * across a gully on its way up would report the dip as extra vertical.
   */
  vertical_m: number;
  /** 3D length along the ground beneath the towers, metres. */
  length_m: number;
  /**
   * OSM's advertised ride time, minutes, or null when it does not say.
   *
   * Baked, never published (SPEC §4) — it is line speed, not the ride anyone
   * gets. Kept because `tests/mountain.golden.test.ts` divides `length_m` by it
   * to check the cable against the speed one of its kind really runs at.
   */
  duration_min: number | null;
  /** Riders per carrier — the quad-or-six-pack question. Null when untagged. */
  occupancy: number | null;
  /**
   * Bottom to top, one entry per OSM node and never resampled: those nodes are
   * the surveyed pylon positions, and interpolating between them would invent
   * towers that do not exist while discarding the ones that do.
   */
  towers: LiftTower[];
}

/** What kind of thing a named place on the mountain is. */
export type PlaceKind = "lodge" | "peak" | "viewpoint";

/** A named point on the mountain: somewhere to eat, a summit, a view. */
export interface Place {
  /**
   * Prefixed with the OSM element type — `n123` / `w123`. Nodes and ways are
   * separate id spaces, so a bare id would let a lodge mapped as a building
   * silently displace one mapped as a point.
   */
  id: string;
  /** Unnamed places are not baked: a marker nobody can read is noise on the map. */
  name: string;
  kind: PlaceKind;
  lon: number;
  lat: number;
  /** DEM elevation here, metres — where the marker sits on the rendered surface. */
  surface_m: number;
  /**
   * OSM's surveyed height, peaks only, null when untagged.
   *
   * The one number in this project that is read rather than derived. A 30m DEM
   * resamples a sharp summit low — measurably so, see the phase 1 notes in
   * PHASES.md — so the mountain's own published height is the better fact, and
   * `surface_m` stays beside it rather than being overwritten by it.
   */
  ele_m: number | null;
}

/** Geographic bounds, WGS84 degrees. */
export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** A resort's baked artifacts and the metadata needed to render them. */
export interface Resort {
  slug: string;
  name: string;
  /** Country, shown so Niseko reads as the deliberate non-Canadian case it is. */
  country: string;
  bounds: Bounds;
  /** Centre point, used for sun position (SPEC §5.2). */
  lat: number;
  lon: number;
  /**
   * IANA zone of the resort, so the sun slider reads a wall clock on the
   * mountain rather than on the visitor. Configured in `resorts.json` and baked
   * rather than resolved at runtime: the page is prerendered, and
   * `Conditions.timezone` — the same zone, as Open-Meteo resolved it from the
   * coordinates — only arrives after hydration and is null when that call fails.
   */
  timezone: string;
  /** Elevation range across the baked heightmap, metres. */
  elevation_min_m: number;
  elevation_max_m: number;
  /** Heightmap dimensions in pixels. */
  width: number;
  height: number;
  /**
   * Ground size of one heightmap pixel, metres. Web Mercator, so this is exact
   * at the resort's latitude and stretches by under half a percent across the
   * box. The app scales the terrain mesh by it — without it there is no way to
   * put the heightmap in real space, and `vertical_exaggeration` means nothing.
   */
  metres_per_pixel: number;
  /**
   * Vertical exaggeration applied when displacing the terrain plane.
   * Tuned by eye per resort — SPEC §13 calls flat-looking terrain a real risk.
   */
  vertical_exaggeration: number;
  /** ISO date this resort was last baked. Shown in the UI: this is a dated snapshot. */
  baked_at: string;
}

/** `public/resorts/manifest.json` — every baked resort, read at build time. */
export interface Manifest {
  generated_at: string;
  resorts: Resort[];
}

/** `public/resorts/<slug>/runs.json`. */
export interface RunsFile {
  slug: string;
  baked_at: string;
  runs: Run[];
}

/** `public/resorts/<slug>/mountain.json` — what is built on the mountain and what is named on it. */
export interface MountainFile {
  slug: string;
  baked_at: string;
  /** Sorted by vertical, descending. The baked order is the read order — the app sorts nothing. */
  lifts: Lift[];
  /** Empty at a resort OSM has named nothing on, which is an ordinary case. */
  places: Place[];
}

/**
 * Live conditions from Open-Meteo, the only outbound call at runtime.
 *
 * The readings are nullable because Open-Meteo omits a variable its model does
 * not carry at a location, and a missing reading must never be published as a
 * zero: at a ski resort "no reading" and "no snow" are opposite facts. An
 * upstream that is *down* is not represented here at all — the route answers
 * 502 rather than dressing an outage up as a reading (SPEC §11, phase 4).
 */
export interface Conditions {
  slug: string;
  /** The instant the reading is for, UTC. */
  observed_at: string;
  /**
   * IANA zone of the resort, as Open-Meteo resolved it from the coordinates —
   * the reading is printed on the mountain's clock, not the reader's and not
   * UTC. Carried as the zone rather than as an offset so the abbreviation
   * follows daylight saving: Lake Louise is MDT in October and MST in January.
   */
  timezone: string | null;
  temperature_c: number | null;
  snowfall_cm_24h: number | null;
  snow_depth_cm: number | null;
  wind_kph: number | null;
  wind_direction_deg: number | null;
}
