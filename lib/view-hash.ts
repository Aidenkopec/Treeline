import { type WallClock, isWallClock } from "./sun";

/**
 * The part of the view that can be sent to someone (SPEC §4, §15). In the hash rather
 * than search params: `useSearchParams` would take the run list out of the prerendered
 * HTML. The camera is absent on purpose, so a link does not move the view on arrival.
 */
export interface ViewState {
  runId: string | null;
  /** The hour the sun is drawn at, on the mountain's clock. Null means now. */
  sun: WallClock | null;
}

export const NO_VIEW: ViewState = { runId: null, sun: null };

/** A value naming nothing — a stale link, a typo — simply selects nothing. */
export function parseViewHash(hash: string): ViewState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const sun = params.get("sun");

  return {
    runId: params.get("run") || null,
    sun: sun !== null && isWallClock(sun) ? sun : null,
  };
}

/**
 * Written by hand rather than through `URLSearchParams`, which percent-encodes the
 * colon in a wall clock. Safe because both halves are known character sets: a run id
 * is an OSM way id, and a wall clock is digits, dashes and `T`.
 */
export function viewHash({ runId, sun }: ViewState): string {
  const parts = [];
  if (runId !== null) parts.push(`run=${runId}`);
  if (sun !== null) parts.push(`sun=${sun}`);
  return parts.length === 0 ? "" : `#${parts.join("&")}`;
}
