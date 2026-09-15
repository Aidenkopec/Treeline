import { kilometres, metres } from "./format";
import type { Lift, LiftKind, Place, PlaceKind } from "./types";

/**
 * How lifts and named places are labelled and drawn.
 *
 * The sibling of `lib/difficulty.ts`, and built the same way: a record keyed by
 * the union, holding the label and the one drawing fact each kind needs, so the
 * components below it decide nothing.
 */

export interface LiftStyle {
  label: string;
  /**
   * Whether this kind hangs from a cable. It decides how the lift is drawn —
   * held up on its pylons, or laid on the snow — so it lives beside the label
   * rather than as a set somewhere in the scene. A magic carpet drawn twelve
   * metres up would be a lie about the mountain.
   */
  aerial: boolean;
}

export const LIFT_STYLES: Record<LiftKind, LiftStyle> = {
  gondola: { label: "Gondola", aerial: true },
  chair_lift: { label: "Chairlift", aerial: true },
  cable_car: { label: "Cable car", aerial: true },
  mixed_lift: { label: "Chair and gondola", aerial: true },
  magic_carpet: { label: "Carpet", aerial: false },
  platter: { label: "Platter", aerial: false },
  "t-bar": { label: "T-bar", aerial: false },
  rope_tow: { label: "Rope tow", aerial: false },
  drag_lift: { label: "Surface lift", aerial: false },
};

export function liftStyle(kind: LiftKind): LiftStyle {
  return LIFT_STYLES[kind];
}

export interface PlaceStyle {
  label: string;
  /**
   * The mark's outline in a 10x10 box, drawn beside the name in the list and
   * again beside the name on the terrain. One string, so the two can never
   * drift into meaning different things.
   *
   * These are survey marks rather than pictograms, which is the difference
   * between a map and a sticker: a summit is the spot-height triangle every
   * topographic map uses, and a lodge is the small pitched roof Swisstopo puts
   * on a Berghütte. Drawn as fine outlines at nine pixels, they read as
   * cartography; drawn as fat filled silhouettes at eighteen, they read as
   * clip art, which is what they were.
   *
   * All three stay clear of the circle, square and diamond that carry run
   * difficulty — a place must never be mistakeable for a grade (SPEC §9 puts
   * that meaning on shape).
   */
  path: string;
  /** Peaks are solid, the way a spot height is. The rest are outlines. */
  filled: boolean;
}

export const PLACE_STYLES: Record<PlaceKind, PlaceStyle> = {
  peak: { label: "Peak", path: "M5 1.2 9.2 8.6 0.8 8.6Z", filled: true },
  viewpoint: { label: "Viewpoint", path: "M5 1.2 9.2 8.6 0.8 8.6Z", filled: false },
  // A roof on two short walls: the hut symbol, not a child's drawing of a house.
  lodge: { label: "Lodge", path: "M1 5.1 5 1.6 9 5.1M2.1 4.4V8.7H7.9V4.4", filled: false },
};

export function placeStyle(kind: PlaceKind): PlaceStyle {
  return PLACE_STYLES[kind];
}

/** Shown where OSM never named a lift, which is usual for the carpets on a beginner area. */
export const UNNAMED_LIFT = "Unnamed lift";

export interface LiftCells {
  name: string;
  /** "6-person chairlift", or just "Chairlift" where OSM does not say. */
  type: string;
  vertical: string;
  length: string;
}

/**
 * A lift's row, pre-formatted.
 *
 * Mirrors `runCells`: the table renders strings and formats nothing, so what a
 * reader sees is testable against the artifact without a DOM.
 */
export function liftCells(lift: Lift): LiftCells {
  const style = liftStyle(lift.kind);
  return {
    name: lift.name ?? UNNAMED_LIFT,
    type: lift.occupancy ? `${lift.occupancy}-person ${style.label.toLowerCase()}` : style.label,
    vertical: metres(lift.vertical_m),
    length: kilometres(lift.length_m),
  };
}

export interface PlaceCells {
  name: string;
  kind: string;
  /** The surveyed height where there is one, otherwise the height off the model. */
  elevation: string;
  /** True when the number above is OSM's rather than this project's. */
  surveyed: boolean;
}

export function placeCells(place: Place): PlaceCells {
  return {
    name: place.name,
    kind: placeStyle(place.kind).label,
    elevation: metres(place.ele_m ?? place.surface_m),
    surveyed: place.ele_m !== null,
  };
}
