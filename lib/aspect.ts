import type { AspectLabel } from "./types";

export const ASPECT_LABELS: readonly AspectLabel[] = [
  "N",
  "NE",
  "E",
  "SE",
  "S",
  "SW",
  "W",
  "NW",
] as const;

/**
 * Bucket a compass bearing into one of eight aspects. Buckets are centred on their
 * label, so N spans 337.5°–22.5° rather than 0°–45°. Shared by the bake and the UI
 * so a run cannot be filtered into one bucket and labelled another.
 */
export function aspectLabel(deg: number): AspectLabel {
  const normalized = ((deg % 360) + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return ASPECT_LABELS[index];
}

/**
 * Whether an aspect holds snow well in the northern hemisphere.
 * Stated as a fact about sun exposure, never as a recommendation (SPEC §8).
 */
export function isShadedAspect(label: AspectLabel): boolean {
  return label === "N" || label === "NE" || label === "NW";
}
