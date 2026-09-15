/**
 * Number formatting.
 *
 * Metric only in v1 — an imperial toggle is deferred (SPEC §16). Precision is
 * capped at what a 30m elevation model can actually support: whole degrees and
 * whole metres. Printing a decimal place would claim accuracy the DEM does not
 * have (SPEC §6).
 */

import { aspectLabel } from "./aspect";

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

/**
 * Wind speed with the direction it blows *from*, which is what the reading
 * means and not how a bare compass point would be read. One function because
 * the fields fail independently: a speed without a direction is still a
 * reading, a direction without a speed is not.
 */
export function wind(kph: number | null, directionDeg: number | null): string {
  if (kph === null) return "—";
  const speed = `${Math.round(kph)}km/h`;
  return directionDeg === null ? speed : `${speed} from ${aspectLabel(directionDeg)}`;
}

/**
 * When a reading was taken, on the clock at the mountain — "3:00 PM MDT", not
 * "21:00 UTC" and not the reader's own zone. An IANA name rather than a fixed
 * abbreviation, so `Intl` follows the changeover: Alberta is MDT for most of a
 * ski season and MST for the rest. `en-US` rather than the reader's locale
 * keeps the readout identical for everyone.
 */
export function observedAt(iso: string, timeZone: string | null): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "—";

  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
    timeZone: timeZone ?? "UTC",
  };

  try {
    return new Intl.DateTimeFormat("en-US", options).format(at);
  } catch {
    // Intl throws on a zone it does not recognise rather than falling back, and
    // this one was named by someone else's API.
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(at);
  }
}
