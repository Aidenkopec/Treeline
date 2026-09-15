import { describe, expect, it } from "vitest";
import {
  type SunPosition,
  instantAt,
  isWallClock,
  joinWallClock,
  splitWallClock,
  openingWallClock,
  sunDirection,
  sunPosition,
  sunTimes,
  wallClockNow,
} from "@/lib/sun";
import type { Resort } from "@/lib/types";

function resort(over: Partial<Resort> = {}): Resort {
  return {
    slug: "test",
    name: "Test",
    country: "Canada",
    bounds: { west: 0, south: 0, east: 1, north: 1 },
    lat: 51.4419,
    lon: -116.1622,
    timezone: "America/Edmonton",
    elevation_min_m: 1000,
    elevation_max_m: 2000,
    width: 5,
    height: 4,
    metres_per_pixel: 10,
    vertical_exaggeration: 1.8,
    baked_at: "2026-09-15",
    ...over,
  };
}

const LAKE_LOUISE = resort();
const NISEKO = resort({ slug: "niseko", lat: 42.8608, lon: 140.6997, timezone: "Asia/Tokyo" });

const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Day length from the textbook hour-angle formula, hours.
 *
 * `cos H = (sin h₀ − sin φ sin δ) / (cos φ cos δ)`, and the day is `2H`. This is
 * the independent half of the gate below: it shares no code path with suncalc,
 * and at a solstice `δ` is the obliquity of the ecliptic, a constant rather than
 * another ephemeris lookup.
 */
function dayLengthHours(latDeg: number, declinationDeg: number): number {
  const HORIZON_DEG = -0.833;
  const cosH =
    (Math.sin(rad(HORIZON_DEG)) - Math.sin(rad(latDeg)) * Math.sin(rad(declinationDeg))) /
    (Math.cos(rad(latDeg)) * Math.cos(rad(declinationDeg)));
  return (2 * ((Math.acos(cosH) * 180) / Math.PI)) / 15;
}

const OBLIQUITY_DEG = 23.44;
const solarDay = (iso: string) => new Date(`${iso}T12:00:00Z`);
const hoursBetween = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 3_600_000;

/**
 * SPEC §11 phase 5: known sunrise and sunset for a fixed date and latitude.
 *
 * "Known" has to mean known independently, or this asserts the library's own
 * output as correct — the mistake `tests/winter.test.ts` was rewritten to stop
 * making. So the day lengths are derived here from the hour-angle formula with
 * the obliquity of the ecliptic as the solstice declination, and the noon
 * altitudes from `90° − φ ± ε`. Both are textbook identities that owe suncalc
 * nothing.
 *
 * The one pin that is a pin — the February clock times — exists to catch a
 * library upgrade moving an answer, and carries a two-minute tolerance because
 * a minute of it is the refraction model's to spend.
 */
describe("the sun over Lake Louise", () => {
  it("rises and sets at the times the almanac prints", () => {
    const { sunrise, sunset } = sunTimes(LAKE_LOUISE, solarDay("2026-02-14"));
    const onTheMountain = (at: Date | null) =>
      new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        hour12: false,
        minute: "2-digit",
        timeZone: LAKE_LOUISE.timezone,
      }).format(at!);

    expect(onTheMountain(sunrise)).toBe("07:59");
    expect(onTheMountain(sunset)).toBe("17:58");
  });

  it("gives each solstice the day length the hour angle says it has", () => {
    const TOLERANCE_H = 2 / 60;

    const winter = sunTimes(LAKE_LOUISE, solarDay("2026-12-21"));
    expect(hoursBetween(winter.sunrise!, winter.sunset!)).toBeCloseTo(
      dayLengthHours(LAKE_LOUISE.lat, -OBLIQUITY_DEG),
      1,
    );
    expect(
      Math.abs(
        hoursBetween(winter.sunrise!, winter.sunset!) -
          dayLengthHours(LAKE_LOUISE.lat, -OBLIQUITY_DEG),
      ),
    ).toBeLessThan(TOLERANCE_H);

    const summer = sunTimes(LAKE_LOUISE, solarDay("2026-06-21"));
    expect(
      Math.abs(
        hoursBetween(summer.sunrise!, summer.sunset!) -
          dayLengthHours(LAKE_LOUISE.lat, OBLIQUITY_DEG),
      ),
    ).toBeLessThan(TOLERANCE_H);
  });

  it("stands due south at solar noon, at the altitude the latitude allows", () => {
    // 90° − φ ± ε. The half-degree tolerance covers refraction and the hours
    // between the solstice instant and the noon this samples.
    for (const [date, declination] of [
      ["2026-12-21", -OBLIQUITY_DEG],
      ["2026-06-21", OBLIQUITY_DEG],
    ] as const) {
      const { sunrise, sunset } = sunTimes(LAKE_LOUISE, solarDay(date));
      const noon = new Date((sunrise!.getTime() + sunset!.getTime()) / 2);
      const { altitudeDeg, azimuthDeg } = sunPosition(LAKE_LOUISE, noon);

      expect(azimuthDeg).toBeCloseTo(180, 1);
      expect(altitudeDeg).toBeCloseTo(90 - LAKE_LOUISE.lat + declination, 0);
    }
  });

  it("reports the same horizon from getTimes and getPosition", () => {
    // The sole cross-check between the two suncalc entry points. Sunrise is
    // solved for a geometric −0.833°, and `altitudeDeg` is refraction-corrected,
    // so the apparent altitude at the moment of sunrise is about −0.35°.
    for (const date of ["2026-02-14", "2026-06-21", "2026-12-21"]) {
      const { sunrise, sunset } = sunTimes(LAKE_LOUISE, solarDay(date));
      expect(sunPosition(LAKE_LOUISE, sunrise!).altitudeDeg).toBeCloseTo(-0.35, 2);
      expect(sunPosition(LAKE_LOUISE, sunset!).altitudeDeg).toBeCloseTo(-0.35, 2);
    }
  });

  it("is dark at midnight and up in the afternoon", () => {
    const at = (wall: string) => sunPosition(LAKE_LOUISE, instantAt(wall, LAKE_LOUISE.timezone));
    expect(at("2026-02-14T00:00").altitudeDeg).toBeLessThan(0);
    expect(at("2026-02-14T14:00").altitudeDeg).toBeGreaterThan(0);
    // Afternoon, so west of south.
    expect(at("2026-02-14T14:00").azimuthDeg).toBeGreaterThan(180);
    expect(at("2026-02-14T09:00").azimuthDeg).toBeLessThan(180);
  });

  it("sees Niseko's sunrise most of a day before its own", () => {
    // A longitude sign error is invisible in a single-resort test and obvious here.
    const here = sunTimes(LAKE_LOUISE, solarDay("2026-02-14")).sunrise!;
    const there = sunTimes(NISEKO, solarDay("2026-02-14")).sunrise!;
    expect(hoursBetween(there, here)).toBeGreaterThan(16);
    expect(hoursBetween(there, here)).toBeLessThan(19);
  });
});

/** Real-world surface normal of a slope of `pitch` facing compass bearing `aspect`. */
function slopeNormal(pitch: number, aspect: number): [number, number, number] {
  return [
    -Math.sin(rad(aspect)) * Math.sin(rad(pitch)),
    Math.cos(rad(pitch)),
    Math.cos(rad(aspect)) * Math.sin(rad(pitch)),
  ];
}

/** The same surface on the mesh: positions scale by diag(1, k, 1), normals by its inverse transpose. */
function meshNormal(pitch: number, aspect: number, k: number): [number, number, number] {
  const [x, y, z] = slopeNormal(pitch, aspect);
  const length = Math.hypot(x, y / k, z);
  return [x / length, y / k / length, z / length];
}

function trueSunVector({ altitudeDeg, azimuthDeg }: SunPosition): [number, number, number] {
  const ground = Math.cos(rad(altitudeDeg));
  return [
    ground * Math.sin(rad(azimuthDeg)),
    Math.sin(rad(altitudeDeg)),
    -ground * Math.cos(rad(azimuthDeg)),
  ];
}

const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function everySlopeAndSun(): { pitch: number; aspect: number; sun: SunPosition }[] {
  const cases = [];
  for (let pitch = 0; pitch <= 60; pitch += 2) {
    for (let aspect = 0; aspect < 360; aspect += 5) {
      for (const altitudeDeg of [2, 5, 10, 20, 35, 55]) {
        for (const azimuthDeg of [90, 135, 180, 225, 270]) {
          cases.push({ pitch, aspect, sun: { altitudeDeg, azimuthDeg } });
        }
      }
    }
  }
  return cases;
}

describe("the sun as a direction over an exaggerated mesh", () => {
  it("points where the compass says, in the mesh's own axes", () => {
    const flat = (azimuthDeg: number) => sunDirection({ altitudeDeg: 0, azimuthDeg }, 1);
    // X east, Z south, matching lonLatToMesh and aspectNormal.
    expect(flat(0)[2]).toBeCloseTo(-1, 10);
    expect(flat(90)[0]).toBeCloseTo(1, 10);
    expect(flat(180)[2]).toBeCloseTo(1, 10);
    expect(flat(270)[0]).toBeCloseTo(-1, 10);
    expect(sunDirection({ altitudeDeg: 90, azimuthDeg: 0 }, 1)[1]).toBeCloseTo(1, 10);
  });

  it("is a unit vector at every exaggeration", () => {
    for (const k of [1, 1.4, 1.8, 3]) {
      const v = sunDirection({ altitudeDeg: 33, azimuthDeg: 214 }, k);
      expect(Math.hypot(...v)).toBeCloseTo(1, 12);
    }
  });

  it("puts the terminator exactly where the real mountain has it", () => {
    // The whole reason the vertical component is scaled. Normalising the two
    // vectors leaves a positive factor, and a positive factor cannot change a
    // sign — so lit and shaded are decided by the true geometry, not by the
    // exaggeration. The only disagreements are slopes the sun grazes exactly.
    const k = 1.8;
    const cases = everySlopeAndSun();
    let graze = 0;
    for (const { pitch, aspect, sun } of cases) {
      const truth = dot(trueSunVector(sun), slopeNormal(pitch, aspect));
      const rendered = dot(sunDirection(sun, k), meshNormal(pitch, aspect, k));
      if (Math.abs(truth) < 1e-12) {
        graze++;
        continue;
      }
      expect(Math.sign(rendered), `pitch ${pitch} aspect ${aspect}`).toBe(Math.sign(truth));
    }
    // Slopes the sun lies exactly along, where the sign is the float noise's to
    // decide and there is nothing to be right about.
    expect(graze / cases.length).toBeLessThan(0.001);
  });

  it("shades one pitch's aspects in exactly the real proportions", () => {
    // Within a pitch the rendered term is the true term times one constant, so
    // "this face is twice as lit as that one" survives the exaggeration intact.
    const k = 1.8;
    const sun = { altitudeDeg: 25, azimuthDeg: 210 };
    for (const pitch of [10, 25, 40]) {
      const ratios = [];
      for (let aspect = 0; aspect < 360; aspect += 15) {
        const truth = dot(trueSunVector(sun), slopeNormal(pitch, aspect));
        if (truth <= 0.02) continue;
        ratios.push(dot(sunDirection(sun, k), meshNormal(pitch, aspect, k)) / truth);
      }
      expect(Math.max(...ratios) - Math.min(...ratios)).toBeLessThan(1e-12);
    }
  });

  it("would put thousands of slopes on the wrong side of lit unscaled", () => {
    // The measurement that makes the scaling a decision rather than a flourish.
    const k = 1.8;
    const cases = everySlopeAndSun();
    const wrong = cases.filter(({ pitch, aspect, sun }) => {
      const truth = dot(trueSunVector(sun), slopeNormal(pitch, aspect));
      const naive = dot(trueSunVector(sun), meshNormal(pitch, aspect, k));
      return Math.abs(truth) > 1e-12 && Math.sign(naive) !== Math.sign(truth);
    });
    expect(wrong.length / cases.length).toBeGreaterThan(0.05);
  });
});

describe("the mountain's clock", () => {
  it("turns a wall clock into the instant it names, either side of the changeover", () => {
    // Alberta is MST (−7) in January and MDT (−6) in July.
    expect(instantAt("2026-01-15T14:00", "America/Edmonton").toISOString()).toBe(
      "2026-01-15T21:00:00.000Z",
    );
    expect(instantAt("2026-07-15T14:00", "America/Edmonton").toISOString()).toBe(
      "2026-07-15T20:00:00.000Z",
    );
    // Japan has never kept daylight saving.
    expect(instantAt("2026-01-15T14:00", "Asia/Tokyo").toISOString()).toBe(
      "2026-01-15T05:00:00.000Z",
    );
    expect(instantAt("2026-07-15T14:00", "Asia/Tokyo").toISOString()).toBe(
      "2026-07-15T05:00:00.000Z",
    );
  });

  it("still answers for an hour the clock skips", () => {
    // 2026-03-08, 02:00 MST becomes 03:00 MDT, so 02:30 is a reading that never
    // occurs in Alberta. There is no correct instant, only a choice; this lands
    // an hour early, at 01:30 MST. What matters is that it is a real instant on
    // the right day rather than an Invalid Date, because the slider can be
    // dragged across that hour.
    expect(instantAt("2026-03-08T02:30", "America/Edmonton").toISOString()).toBe(
      "2026-03-08T08:30:00.000Z",
    );
  });

  it("round-trips every minute of the year except the skipped hour", () => {
    const zone = "America/Edmonton";
    const missed = [];
    for (let day = new Date("2026-01-01T12:00:00Z"); day.getUTCFullYear() === 2026;) {
      const date = day.toISOString().slice(0, 10);
      for (const minutes of [0, 150, 780, 1439]) {
        const wall = joinWallClock(date, minutes);
        if (wallClockNow(zone, instantAt(wall, zone)) !== wall) missed.push(wall);
      }
      day = new Date(day.getTime() + 86_400_000);
    }
    expect(missed).toEqual(["2026-03-08T02:30"]);
  });

  it("round-trips a wall clock through the instant it names", () => {
    for (const wall of ["2026-01-01T00:00", "2026-06-21T13:46", "2026-11-01T01:30"]) {
      const instant = instantAt(wall, "America/Edmonton");
      expect(wallClockNow("America/Edmonton", instant)).toBe(wall);
    }
  });

  it("reads midnight as the start of its own day, not the end of the last", () => {
    // en-US with hour12 false prints midnight as 24, which rolls the date over.
    expect(wallClockNow("America/Edmonton", new Date("2026-02-14T07:00:00Z"))).toBe(
      "2026-02-14T00:00",
    );
  });

  it("accepts a wall clock only when it is one", () => {
    expect(isWallClock("2026-02-14T14:00")).toBe(true);
    expect(isWallClock("2026-02-30T14:00")).toBe(false);
    expect(isWallClock("2026-02-14T24:00")).toBe(false);
    expect(isWallClock("2026-02-14T14:60")).toBe(false);
    expect(isWallClock("2026-2-14T14:00")).toBe(false);
    expect(isWallClock("2026-02-14")).toBe(false);
    expect(isWallClock("")).toBe(false);
  });

  it("splits and rejoins what the date input and the slider edit", () => {
    expect(splitWallClock("2026-02-14T14:30")).toEqual({ date: "2026-02-14", minutes: 870 });
    expect(joinWallClock("2026-02-14", 870)).toBe("2026-02-14T14:30");
    expect(joinWallClock("2026-02-14", 0)).toBe("2026-02-14T00:00");
    expect(joinWallClock("2026-02-14", 1439)).toBe("2026-02-14T23:59");
    // The slider cannot leave its own track, and a rounding error must not
    // roll the readout onto the next day.
    expect(joinWallClock("2026-02-14", 1440)).toBe("2026-02-14T23:59");
    expect(joinWallClock("2026-02-14", -1)).toBe("2026-02-14T00:00");
  });
});

describe("the hour the page opens at", () => {
  it("is the one it is on the mountain, while the sun is up", () => {
    // 21:00Z on 14 February is 2pm MST, and the sun is well up.
    expect(openingWallClock(LAKE_LOUISE, new Date("2026-02-14T21:00:00Z"))).toBe(
      "2026-02-14T14:00",
    );
  });

  it("is solar noon of that same local day when the sun is down", () => {
    // 06:00Z on 15 February is 11pm on the 14th in Alberta. The framing is
    // midday on the 14th, not on the 15th — `getTimes` keys off the UTC solar
    // day, which has already rolled over.
    const opened = openingWallClock(LAKE_LOUISE, new Date("2026-02-15T06:00:00Z"));
    expect(opened.slice(0, 10)).toBe("2026-02-14");
    expect(opened).toBe("2026-02-14T12:58");
  });

  it("opens on a lit mountain at every hour of a winter day", () => {
    for (let hour = 0; hour < 24; hour++) {
      const now = new Date(Date.UTC(2026, 11, 21, hour));
      const opened = openingWallClock(LAKE_LOUISE, now);
      const altitude = sunPosition(
        LAKE_LOUISE,
        instantAt(opened, LAKE_LOUISE.timezone),
      ).altitudeDeg;
      expect(altitude, `${now.toISOString()} -> ${opened}`).toBeGreaterThan(0);
    }
  });

  it("does the same in the other hemisphere's zone", () => {
    for (let hour = 0; hour < 24; hour++) {
      const opened = openingWallClock(NISEKO, new Date(Date.UTC(2026, 1, 14, hour)));
      expect(sunPosition(NISEKO, instantAt(opened, NISEKO.timezone)).altitudeDeg).toBeGreaterThan(
        0,
      );
    }
  });
});
