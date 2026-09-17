import { getPosition, getTimes } from "suncalc";
import type { Resort } from "./types";

/**
 * Where the sun stands over a resort. Illumination only, never a terrain derivative
 * (SPEC §8). The one place this project reads `suncalc`, whose conventions are the risk:
 * v2 answers in degrees with azimuth clockwise from north. `tests/sun.test.ts` pins it.
 */

export interface SunPosition {
  /** Degrees above the horizon, refraction-corrected. Negative below it. */
  altitudeDeg: number;
  /** Degrees clockwise from north: 0 = N, 90 = E, 180 = S, 270 = W. */
  azimuthDeg: number;
}

export function sunPosition(resort: Resort, at: Date): SunPosition {
  const { altitude, azimuth } = getPosition(at, resort.lat, resort.lon);
  return { altitudeDeg: altitude, azimuthDeg: azimuth };
}

/**
 * Sunrise and sunset for the solar day `at` falls in. Null when the sun never crosses the
 * horizon, a real answer above the Arctic circle and not one these six resorts reach.
 */
export function sunTimes(
  resort: Resort,
  at: Date,
): { sunrise: Date | null; sunset: Date | null; solarNoon: Date } {
  const { sunrise, sunset, solarNoon } = getTimes(at, resort.lat, resort.lon);
  return { sunrise, sunset, solarNoon };
}

/**
 * The unit vector towards the sun, in the mesh's own axes: X east, Z south, Y up. The
 * vertical component is multiplied by the exaggeration because the mesh is, so the two
 * cancel in `L·N`. Pass the raw vector and 6.3% of slopes land on the wrong side of lit.
 */
export function sunDirection(
  { altitudeDeg, azimuthDeg }: SunPosition,
  verticalExaggeration: number,
): [number, number, number] {
  const altitude = (altitudeDeg * Math.PI) / 180;
  const azimuth = (azimuthDeg * Math.PI) / 180;
  const ground = Math.cos(altitude);

  const x = ground * Math.sin(azimuth);
  const y = Math.sin(altitude) * verticalExaggeration;
  const z = -ground * Math.cos(azimuth);

  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

/**
 * A time on the mountain's clock, `YYYY-MM-DDTHH:mm`. Not an instant: a reader picks "2pm
 * at Lake Louise", and which instant that names depends on the zone and the time of year.
 */
export type WallClock = string;

const SHAPE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Shape *and* calendar: `2026-02-30T14:00` is well-formed and is not a date. */
export function isWallClock(value: string): value is WallClock {
  const parts = SHAPE.exec(value);
  if (parts === null) return false;

  const [, year, month, day, hour, minute] = parts.map(Number);
  if (hour > 23 || minute > 59) return false;

  const asUtc = new Date(Date.UTC(year, month - 1, day));
  return (
    asUtc.getUTCFullYear() === year &&
    asUtc.getUTCMonth() === month - 1 &&
    asUtc.getUTCDate() === day
  );
}

/** The wall clock `instant` shows in `timeZone`, as a UTC timestamp. */
function asIfUtc(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(new Date(instant));

  const field = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  // en-US with hour12 false prints midnight as 24, which Date.UTC rolls into the next day.
  return Date.UTC(
    field("year"),
    field("month") - 1,
    field("day"),
    field("hour") % 24,
    field("minute"),
    field("second"),
  );
}

/**
 * The UTC instant a wall clock names in a zone. `Intl` only goes the other way, so this
 * reads the clock as UTC and corrects twice, because the offset near the answer is not
 * always the offset near the guess. In the hour spring-forward skips, returns the shift.
 */
export function instantAt(wall: WallClock, timeZone: string): Date {
  const wanted = Date.parse(`${wall}:00Z`);
  const once = wanted - (asIfUtc(wanted, timeZone) - wanted);
  return new Date(wanted - (asIfUtc(once, timeZone) - once));
}

/** What time it is on the mountain now. */
export function wallClockNow(timeZone: string, now: Date = new Date()): WallClock {
  return new Date(asIfUtc(now.getTime(), timeZone)).toISOString().slice(0, 16);
}

/** The two halves a date input and a time slider edit separately. */
export function splitWallClock(wall: WallClock): { date: string; minutes: number } {
  return {
    date: wall.slice(0, 10),
    minutes: Number(wall.slice(11, 13)) * 60 + Number(wall.slice(14, 16)),
  };
}

export function joinWallClock(date: string, minutes: number): WallClock {
  const clamped = Math.min(1439, Math.max(0, Math.round(minutes)));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date}T${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

/**
 * The hour the page opens at: now on the mountain, unless the sun is down, since a black
 * massif says nothing about the terrain. Solar noon is resolved from the local midday,
 * because `getTimes` keys off the UTC solar day and at 11pm in Alberta that is tomorrow.
 */
export function openingWallClock(resort: Resort, now: Date = new Date()): WallClock {
  const wall = wallClockNow(resort.timezone, now);
  if (sunPosition(resort, now).altitudeDeg > 0) return wall;

  const midday = instantAt(`${wall.slice(0, 10)}T12:00`, resort.timezone);
  return wallClockNow(resort.timezone, sunTimes(resort, midday).solarNoon);
}
