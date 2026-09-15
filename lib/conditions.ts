import type { Conditions } from "./types";

/**
 * Open-Meteo's forecast response, mapped to this project's `Conditions` shape.
 *
 * Kept out of the route handler so node can test it, the same split as
 * `lib/run-list.ts`: the mapping is where the mistakes are. Snow depth arrives
 * in metres, a variable the model does not carry is an absent key rather than a
 * null, and an error body is valid JSON that parses happily into something with
 * no reading in it at all. The handler is fetch and headers (SPEC §5).
 */

export const OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast";

/** The fields this project asks for. Open-Meteo returns a great deal more. */
export interface OpenMeteoForecast {
  /** IANA zone Open-Meteo resolved from the coordinates, e.g. "America/Edmonton". */
  timezone?: string;
  utc_offset_seconds?: number;
  current?: {
    time?: string;
    temperature_2m?: number;
    snow_depth?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
  };
  hourly?: { snowfall?: number[] };
}

export function conditionsUrl(lat: number, lon: number): string {
  const url = new URL(OPEN_METEO_FORECAST);
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,snow_depth,wind_speed_10m,wind_direction_10m",
    // A rolling 24 hours, summed below. `daily=snowfall_sum` would answer a
    // different question — how much has fallen since midnight — and at 9am that
    // is not what "snow in the last 24 hours" means.
    hourly: "snowfall",
    past_hours: "24",
    forecast_hours: "0",
    // Resolved from the coordinates, so `current.time` comes back on the
    // resort's own clock and `utc_offset_seconds` turns it back into an
    // instant. Asking for UTC instead would mean this project deciding what
    // timezone six resorts on two continents are in.
    timezone: "auto",
    wind_speed_unit: "kmh",
  }).toString();
  return url.toString();
}

/**
 * `null` when the payload carries no reading at all — an error body, or a
 * response whose `current` block never arrived. The route answers 502 to that
 * rather than publishing a `Conditions` of nulls, which would read as "no snow".
 */
export function parseConditions(slug: string, payload: unknown): Conditions | null {
  const forecast = payload as OpenMeteoForecast | null | undefined;
  const current = forecast?.current;
  if (!current || typeof current.time !== "string") return null;

  const observed_at = toInstant(current.time, reading(forecast?.utc_offset_seconds) ?? 0);
  if (observed_at === null) return null;

  const depth_m = reading(current.snow_depth);

  return {
    slug,
    observed_at,
    timezone: typeof forecast?.timezone === "string" ? forecast.timezone : null,
    temperature_c: reading(current.temperature_2m),
    snowfall_cm_24h: sumSnowfall((payload as OpenMeteoForecast).hourly?.snowfall),
    // Metres in the response, centimetres everywhere in this project. Scaling
    // by 1000 and back by 10 rather than by 100 keeps 2.69 from becoming
    // 268.99999999999994 — the same two decimal places the source published.
    snow_depth_cm: depth_m === null ? null : Math.round(depth_m * 1000) / 10,
    wind_kph: reading(current.wind_speed_10m),
    wind_direction_deg: reading(current.wind_direction_10m),
  };
}

/**
 * Open-Meteo prints its timestamp with no zone on it — "2026-09-15T15:00" is
 * the resort's wall clock, and only `utc_offset_seconds` says which instant
 * that was. Reading the wall clock as if it were UTC and then subtracting the
 * offset is what turns the two of them back into one.
 */
function toInstant(wallClock: string, offsetSeconds: number): string | null {
  const asIfUtc = Date.parse(`${wallClock}Z`);
  if (Number.isNaN(asIfUtc)) return null;
  return new Date(asIfUtc - offsetSeconds * 1000).toISOString();
}

/** An absent variable is null, never 0: "no reading" and "no snow" are not the same fact. */
function reading(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sumSnowfall(hourly: number[] | undefined): number | null {
  if (!Array.isArray(hourly) || hourly.length === 0) return null;

  let total = 0;
  for (const hour of hourly) {
    if (typeof hour === "number" && Number.isFinite(hour)) total += hour;
  }
  // Two decimal places, as published. Adding 24 of them in binary floating point
  // otherwise reports 3.43cm of snow as 3.4299999999999997.
  return Math.round(total * 100) / 100;
}
