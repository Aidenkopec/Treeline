/**
 * Number formatting. Metric only in v1; an imperial toggle is deferred (SPEC §16).
 * Precision is capped at whole degrees and whole metres, because a decimal place would
 * claim accuracy a 30m elevation model does not have (SPEC §6).
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
 * Wind speed with the direction it blows *from*. One function because the fields fail
 * independently: a speed without a direction is still a reading, the reverse is not.
 */
export function wind(kph: number | null, directionDeg: number | null): string {
  if (kph === null) return "—";
  const speed = `${Math.round(kph)}km/h`;
  return directionDeg === null ? speed : `${speed} from ${aspectLabel(directionDeg)}`;
}

/**
 * When a reading was taken, on the clock at the mountain. An IANA name rather than a
 * fixed abbreviation, so `Intl` follows the MST/MDT changeover, and `en-US` rather than
 * the reader's locale so the readout is identical for everyone.
 */
function onTheMountain(at: Date, timeZone: string | null, nameTheZone: boolean): string {
  if (Number.isNaN(at.getTime())) return "—";

  const options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timeZone ?? "UTC",
    ...(nameTheZone ? { timeZoneName: "short" as const } : {}),
  };

  try {
    return new Intl.DateTimeFormat("en-US", options).format(at);
  } catch {
    // Intl throws on an unrecognised zone, and this one was named by someone else's API.
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(at);
  }
}

export function observedAt(iso: string, timeZone: string | null): string {
  return onTheMountain(new Date(iso), timeZone, true);
}

/** The same clock with the zone left unsaid, for times printed in a set that shares one. */
export function clockTime(at: Date, timeZone: string): string {
  return onTheMountain(at, timeZone, false);
}
