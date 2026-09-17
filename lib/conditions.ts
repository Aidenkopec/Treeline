import type { Conditions } from "./types";

/**
 * Open-Meteo's forecast response, mapped to this project's `Conditions` shape. Out of
 * the route handler so node can test it: an error body is valid JSON that parses into
 * something with no reading in it, and an absent variable is a missing key, not a null.
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
  hourly?: { snowfall?: (number | null)[] };
}

export function conditionsUrl(lat: number, lon: number): string {
  const url = new URL(OPEN_METEO_FORECAST);
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,snow_depth,wind_speed_10m,wind_direction_10m",
    // A rolling 24 hours: `daily=snowfall_sum` answers since midnight, a different thing.
    hourly: "snowfall",
    past_hours: "24",
    forecast_hours: "0",
    // `auto` so `current.time` is the resort's own clock, resolved upstream and not here.
    timezone: "auto",
    wind_speed_unit: "kmh",
  }).toString();
  return url.toString();
}

/**
 * `null` when the payload carries no reading at all — an error body, or a
 * response whose `current` block never arrived. The route answers 502 to that.
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
    snowfall_cm_24h: sumSnowfall(forecast?.hourly?.snowfall),
    // Metres in the response, centimetres everywhere in this project.
    snow_depth_cm: depth_m === null ? null : Math.round(depth_m * 1000) / 10,
    wind_kph: reading(current.wind_speed_10m),
    wind_direction_deg: reading(current.wind_direction_10m),
  };
}

/**
 * Open-Meteo prints its timestamp with no zone: "2026-09-15T15:00" is the resort's wall
 * clock, and only `utc_offset_seconds` says which instant that was. Parsing it as UTC
 * and subtracting the offset turns the two back into one.
 */
function toInstant(wallClock: string, offsetSeconds: number): string | null {
  const asIfUtc = Date.parse(`${wallClock}Z`);
  if (Number.isNaN(asIfUtc)) return null;
  return new Date(asIfUtc - offsetSeconds * 1000).toISOString();
}

/** An absent variable is null, never 0. */
function reading(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * `null` unless at least one hour reported. An hour the model has no value for
 * arrives as a null inside an array that is otherwise present and full length,
 * so counting those as zeros would publish an unpopulated forecast as "0cm".
 */
function sumSnowfall(hourly: (number | null)[] | undefined): number | null {
  if (!Array.isArray(hourly)) return null;

  let total = 0;
  let read = false;
  for (const hour of hourly) {
    if (typeof hour === "number" && Number.isFinite(hour)) {
      total += hour;
      read = true;
    }
  }
  // Two decimal places, as published: a float sum of them can carry a tail.
  return read ? Math.round(total * 100) / 100 : null;
}
