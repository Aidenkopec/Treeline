import type { ProfileSample } from "./types";

/**
 * A run's sampled elevations as SVG path data.
 *
 * Straight segments between samples, not a smoothed curve: `components/
 * ridgeline.tsx` smooths because it is drawing an idea of a mountain, and this
 * is drawing 25m measurements — the corners are the data. Kept out of the
 * component so the shape can be asserted; a chart that renders a plausible
 * slope from the wrong axis still looks like a chart.
 */

export interface ProfileGeometry {
  /** Path data for the line itself. Empty when there is nothing to draw. */
  line: string;
  /** The same line closed down to the baseline, for the fill underneath. */
  area: string;
  /** Highest and lowest elevation in the profile, metres — the y axis. */
  topM: number;
  bottomM: number;
  /** Distance the x axis spans, metres. */
  lengthM: number;
}

const EMPTY: ProfileGeometry = { line: "", area: "", topM: 0, bottomM: 0, lengthM: 0 };

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function profileGeometry(
  profile: ProfileSample[],
  width: number,
  height: number,
): ProfileGeometry {
  if (profile.length < 2) return EMPTY;

  const elevations = profile.map((p) => p.e);
  const topM = Math.max(...elevations);
  const bottomM = Math.min(...elevations);
  const lengthM = profile[profile.length - 1].d;

  // A run with no drop and a run of no length both flatten the denominator.
  // Draw them along the middle rather than dividing by zero.
  const relief = topM - bottomM;
  const y = (e: number) => (relief === 0 ? height / 2 : ((topM - e) / relief) * height);
  const x = (d: number) => (lengthM === 0 ? 0 : (d / lengthM) * width);

  const points = profile.map((p) => `${round(x(p.d))} ${round(y(p.e))}`);
  const line = `M${points.join(" L")}`;

  return {
    line,
    area: `${line} L${round(width)} ${round(height)} L0 ${round(height)} Z`,
    topM,
    bottomM,
    lengthM,
  };
}
