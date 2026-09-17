import type { ProfileSample } from "./types";

/**
 * A run's sampled elevations as SVG path data. Straight segments rather than a smoothed
 * curve: these are 25m measurements and the corners are the data. Out of the component
 * so the shape can be asserted; a chart drawn off the wrong axis still looks like one.
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

  // No drop and no length each flatten a denominator; draw down the middle instead.
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
