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
