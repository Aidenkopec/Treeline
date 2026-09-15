import { type WallClock, isWallClock } from "./sun";

/**
 * The part of the view that can be sent to someone (SPEC §4, §15).
 *
 * In the hash rather than in search params, because `useSearchParams` would
 * take the run list out of the prerendered HTML to answer the same question —
 * the trap phase 3 avoided and phase 4 avoided again. Parsing lives here rather
 * than in the component so it can be tested without a DOM.
 *
 * The camera is deliberately absent. A link that starts moving the view on
 * arrival is a surprise, and riding a run is an action rather than a view.
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
 * Written by hand rather than through `URLSearchParams`, which percent-encodes
 * the colon in a wall clock. A colon is legal in a fragment, and a shared link
 * should read as the time it carries. Both halves are known character sets —
 * a run id is an OSM way id, and a wall clock is digits, dashes and `T`.
 */
export function viewHash({ runId, sun }: ViewState): string {
  const parts = [];
  if (runId !== null) parts.push(`run=${runId}`);
  if (sun !== null) parts.push(`sun=${sun}`);
  return parts.length === 0 ? "" : `#${parts.join("&")}`;
}
