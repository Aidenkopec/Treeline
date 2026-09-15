import { describe, expect, it } from "vitest";
import { conditionsUrl, parseConditions } from "@/lib/conditions";
import { celsius, centimetres, observedAt, wind } from "@/lib/format";
import deepSnow from "./fixtures/open-meteo-deep-snow.json" with { type: "json" };
import errorBody from "./fixtures/open-meteo-error.json" with { type: "json" };
import lakeLouise from "./fixtures/open-meteo-lake-louise.json" with { type: "json" };
import missingVariables from "./fixtures/open-meteo-missing-variables.json" with { type: "json" };

describe("the request", () => {
  const url = new URL(conditionsUrl(51.4419, -116.1622));

  it("asks for the four readings the strip prints", () => {
    expect(url.searchParams.get("current")).toBe(
      "temperature_2m,snow_depth,wind_speed_10m,wind_direction_10m",
    );
  });

  it("asks for a rolling 24 hours of snowfall, not the calendar day so far", () => {
    expect(url.searchParams.get("hourly")).toBe("snowfall");
    expect(url.searchParams.get("past_hours")).toBe("24");
    expect(url.searchParams.get("forecast_hours")).toBe("0");
  });

  it("lets Open-Meteo resolve the resort's timezone from its coordinates", () => {
    expect(url.searchParams.get("timezone")).toBe("auto");
  });

  it("pins the wind unit rather than taking the default on trust", () => {
    expect(url.searchParams.get("wind_speed_unit")).toBe("kmh");
  });

  it("carries no key, because Open-Meteo has none to carry", () => {
    expect(url.search).not.toMatch(/key|token|apikey/i);
  });
});

/**
 * The conversions in parseConditions are only correct while Open-Meteo keeps
 * sending what it sent when they were written, and a unit change upstream would
 * be invisible: metres published as centimetres is a plausible-looking number,
 * not a crash. So the fixtures are asserted against their own declared units —
 * if a re-recording ever disagrees, this fails before the arithmetic does.
 */
describe("the units the readings arrive in", () => {
  for (const [name, fixture] of [
    ["Lake Louise", lakeLouise],
    ["Mount Cook", deepSnow],
  ] as const) {
    it(`are the ones ${name}'s response declares`, () => {
      expect(fixture.current_units.temperature_2m).toBe("°C");
      // The one that is not centimetres, and the reason snow_depth is scaled.
      expect(fixture.current_units.snow_depth).toBe("m");
      expect(fixture.current_units.wind_speed_10m).toBe("km/h");
      expect(fixture.current_units.wind_direction_10m).toBe("°");
      expect(fixture.hourly_units.snowfall).toBe("cm");
    });
  }
});

describe("a complete reading", () => {
  it("maps the recorded Lake Louise response field by field", () => {
    expect(parseConditions("lake-louise", lakeLouise)).toEqual({
      slug: "lake-louise",
      // Open-Meteo answered "2026-09-15T15:00" on Alberta's clock at UTC-6.
      observed_at: "2026-09-15T21:00:00.000Z",
      timezone: "America/Edmonton",
      temperature_c: 6.6,
      snowfall_cm_24h: 0,
      snow_depth_cm: 0,
      wind_kph: 13.2,
      wind_direction_deg: 133,
    });
  });

  it("reports a real September zero as a zero, not as a missing reading", () => {
    const conditions = parseConditions("lake-louise", lakeLouise)!;
    expect(conditions.snow_depth_cm).toBe(0);
    expect(conditions.snow_depth_cm).not.toBeNull();
  });
});

/**
 * The Lake Louise fixture is all zeros on a North American clock, and each of
 * those hides a mistake: a unit conversion and a sum can both be wrong in every
 * way and still produce 0, and an off-by-one timezone still lands on the right
 * calendar day. Mount Cook is in late winter across the date line, so it cannot.
 */
describe("a reading with snow in it, on the other side of the world", () => {
  const conditions = parseConditions("mount-cook", deepSnow)!;

  it("publishes snow depth in centimetres, having been given metres", () => {
    expect(deepSnow.current.snow_depth).toBe(2.69);
    expect(conditions.snow_depth_cm).toBe(269);
  });

  it("sums all 24 hourly values rather than reading one of them", () => {
    const hourly = deepSnow.hourly.snowfall;
    expect(hourly).toHaveLength(24);
    expect(hourly.filter((cm) => cm > 0).length).toBe(12);
    // 3.78, not 3.7800000000000002: 24 additions of two-decimal values in
    // binary floating point do not land on the number that was published.
    expect(conditions.snowfall_cm_24h).toBe(3.78);
  });

  it("reads a negative temperature without confusing it for a missing one", () => {
    expect(conditions.temperature_c).toBe(-11);
  });

  it("resolves a local time a calendar day ahead of the instant it reports", () => {
    expect(deepSnow.current.time).toBe("2026-09-16T09:00");
    expect(conditions.observed_at).toBe("2026-09-15T21:00:00.000Z");
    expect(conditions.timezone).toBe("Pacific/Auckland");
  });

  it("is the same instant Lake Louise was read at, on a different clock", () => {
    expect(conditions.observed_at).toBe(parseConditions("x", lakeLouise)!.observed_at);
  });
});

describe("a reading with variables the model does not carry", () => {
  const conditions = parseConditions("lake-louise", missingVariables)!;

  it("still reads the variables that did arrive", () => {
    expect(conditions.temperature_c).toBe(6.6);
    expect(conditions.wind_kph).toBe(13.2);
  });

  it("returns null for an absent variable, never 0", () => {
    expect(conditions.snow_depth_cm).toBeNull();
    expect(conditions.wind_direction_deg).toBeNull();
  });

  it("returns null when the whole hourly block is absent", () => {
    expect(conditions.snowfall_cm_24h).toBeNull();
  });
});

/**
 * An Open-Meteo error is valid JSON and parses without complaint, so nothing
 * downstream of JSON.parse notices it is not a reading. That is how a site ends
 * up publishing an error object as weather; this is where it stops.
 */
describe("a payload that is not a reading", () => {
  it("is null for a recorded Open-Meteo error body", () => {
    expect(parseConditions("lake-louise", errorBody)).toBeNull();
  });

  it("is null when the current block never arrived", () => {
    expect(parseConditions("lake-louise", { hourly: { snowfall: [1, 2] } })).toBeNull();
  });

  it("is null when current carries no timestamp to report the reading against", () => {
    expect(parseConditions("lake-louise", { current: { temperature_2m: 6.5 } })).toBeNull();
  });

  it("is null when the timestamp is not a time", () => {
    expect(parseConditions("lake-louise", { current: { time: "sometime tuesday" } })).toBeNull();
  });

  it("does not throw on anything else that came back", () => {
    expect(parseConditions("lake-louise", null)).toBeNull();
    expect(parseConditions("lake-louise", undefined)).toBeNull();
    expect(parseConditions("lake-louise", "<html>502 Bad Gateway</html>")).toBeNull();
    expect(parseConditions("lake-louise", [])).toBeNull();
  });

  it("reads a response with no timezone on it as UTC rather than refusing it", () => {
    const conditions = parseConditions("x", { current: { time: "2026-09-15T21:00" } })!;
    expect(conditions.observed_at).toBe("2026-09-15T21:00:00.000Z");
    expect(conditions.timezone).toBeNull();
  });
});

describe("what the strip prints", () => {
  it("renders the recorded Mount Cook reading", () => {
    const conditions = parseConditions("mount-cook", deepSnow)!;
    expect(celsius(conditions.temperature_c)).toBe("-11°C");
    expect(centimetres(conditions.snowfall_cm_24h)).toBe("4cm");
    expect(centimetres(conditions.snow_depth_cm)).toBe("269cm");
    // 3°, which is north — the direction the wind is coming from.
    expect(wind(conditions.wind_kph, conditions.wind_direction_deg)).toBe("7km/h from N");
  });

  it("renders every missing reading as a dash, so none of them reads as zero", () => {
    const conditions = parseConditions("lake-louise", missingVariables)!;
    expect(centimetres(conditions.snow_depth_cm)).toBe("—");
    expect(centimetres(conditions.snowfall_cm_24h)).toBe("—");
  });

  it("keeps a wind speed that arrived without a direction", () => {
    expect(wind(13.2, null)).toBe("13km/h");
    expect(wind(null, 133)).toBe("—");
  });
});

/**
 * "21:00 UTC" is the correct instant and tells a skier nothing. The reading is
 * printed on the clock at the mountain, which is the one they can compare
 * against their own watch when they get there.
 */
describe("the time a reading was taken", () => {
  const instant = "2026-09-15T21:00:00.000Z";

  it("is the resort's clock, not the instant", () => {
    expect(observedAt(instant, "America/Edmonton")).toBe("3:00 PM MDT");
  });

  it("follows daylight saving instead of hardcoding one half of the year", () => {
    // The same wall clock in January at the same resort is MST, not MDT.
    expect(observedAt("2026-01-15T22:00:00.000Z", "America/Edmonton")).toBe("3:00 PM MST");
  });

  it("works for a resort that is not in North America", () => {
    expect(observedAt(instant, "Asia/Tokyo")).toBe("6:00 AM GMT+9");
  });

  it("falls back to UTC rather than throwing on a zone it does not know", () => {
    expect(observedAt(instant, null)).toBe("9:00 PM UTC");
    expect(observedAt(instant, "Mars/Olympus_Mons")).toBe("9:00 PM UTC");
  });

  it("does not invent a time it could not read", () => {
    expect(observedAt("not a timestamp", "America/Edmonton")).toBe("—");
  });
});
