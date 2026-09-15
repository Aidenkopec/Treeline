import { getPosition, getTimes } from "suncalc";
import type { Resort } from "./types";

/**
 * Where the sun stands over a resort, and what time it is there.
 *
 * The one place this project reads `suncalc`, because the library's conventions
 * are the whole risk: `suncalc@2` answers in **degrees** with azimuth measured
 * **clockwise from north**, which is the opposite of the radians-from-south
 * convention every older example uses. `tests/sun.test.ts` pins it.
 *
 * A sun is illumination, not a terrain derivative. Nothing here attaches a
 * number to a run, and nothing shades open ground by steepness (SPEC §8).
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
 * Sunrise and sunset for the solar day `at` falls in.
 *
 * Null rather than a date when the sun never crosses the horizon — a real
 * answer above the Arctic circle, and not one any of the six resorts reaches.
 */
export function sunTimes(
  resort: Resort,
  at: Date,
): { sunrise: Date | null; sunset: Date | null; solarNoon: Date } {
  const { sunrise, sunset, solarNoon } = getTimes(at, resort.lat, resort.lon);
  return { sunrise, sunset, solarNoon };
}

/**
 * The unit vector towards the sun, in the terrain mesh's own axes.
 *
 * X east, Z south, Y up — the same frame `lonLatToMesh` builds and
 * `aspectNormal` reads bearings in.
 *
 * The vertical component is multiplied by the exaggeration, and that is the
 * load-bearing line. Mesh positions are the real terrain under the non-uniform
 * scale `diag(1, k, 1)`; a direction between two points scales the same way,
 * while a normal scales by the inverse transpose `diag(1, 1/k, 1)`, so the two
 * `k`s cancel in `L·N` before either vector is normalised. Normalising leaves
 * one positive factor per pitch, which is a contrast trim: it cannot move the
 * terminator, and among slopes of a single pitch the shading is the real
 * mountain's to the last digit.
 *
 * Pass the raw sun vector instead and the sun sits `k` times too low over the
 * terrain. Measured over 67,000 slope-and-sun combinations at k = 1.8, 6.3% of
 * them come out on the wrong side of lit.
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
 * A time on the mountain's clock, `YYYY-MM-DDTHH:mm`.
 *
 * Deliberately not an instant: what a reader picks is "2pm at Lake Louise", and
 * which instant that names depends on the zone and on the time of year. The
 * same string is what travels in the URL.
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
  // en-US with hour12 false prints midnight as 24, which Date.UTC rolls into
  // the next day — correct for a duration, wrong for the clock it is reading.
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
 * The UTC instant a wall clock names in a zone.
 *
 * `Intl` only goes the other way, so this solves for it: read the clock as if
 * it were UTC, ask what offset the zone was on around then, and correct. The
 * second pass is what gets the changeover right — the offset near the answer is
 * not always the offset near the guess. Inside the hour that spring-forward
 * skips there is no such instant at all, and this returns the shifted one.
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
 * The hour the page opens at: now on the mountain, unless the sun is down.
 *
 * A visitor arriving at 11pm would otherwise meet a black massif, which says
 * nothing about the terrain the rest of the page is about — the same kind of
 * framing decision `openingFraming` makes about where to stand. Nothing is
 * hidden by it: the readout states the hour it is drawing, and the slider is
 * sitting on it.
 *
 * Solar noon is resolved from the *local* midday rather than from `now`,
 * because `getTimes` keys off the UTC solar day its argument falls in and at
 * 11pm in Alberta that is already tomorrow.
 */
export function openingWallClock(resort: Resort, now: Date = new Date()): WallClock {
  const wall = wallClockNow(resort.timezone, now);
  if (sunPosition(resort, now).altitudeDeg > 0) return wall;

  const midday = instantAt(`${wall.slice(0, 10)}T12:00`, resort.timezone);
  return wallClockNow(resort.timezone, sunTimes(resort, midday).solarNoon);
}
