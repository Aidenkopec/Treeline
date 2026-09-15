/**
 * Number formatting.
 *
 * Metric only in v1 — an imperial toggle is deferred (SPEC §16). Precision is
 * capped at what a 30m elevation model can actually support: whole degrees and
 * whole metres. Printing a decimal place would claim accuracy the DEM does not
 * have (SPEC §6).
 */

export function metres(value: number): string {
  return `${Math.round(value)}m`;
}

export function kilometres(value: number): string {
  return value < 1000 ? `${Math.round(value)}m` : `${(value / 1000).toFixed(1)}km`;
}

export function degrees(value: number): string {
  return `${Math.round(value)}°`;
}

export function celsius(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}°C`;
}

export function centimetres(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}cm`;
}
