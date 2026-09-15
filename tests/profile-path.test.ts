import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { profileGeometry } from "@/lib/profile-path";
import type { ProfileSample, RunsFile } from "@/lib/types";

/** A descent whose corners are known by construction: 100m over 400m, in four steps. */
const fixture: ProfileSample[] = [
  { d: 0, e: 2100, lon: -116.1, lat: 51.45 },
  { d: 100, e: 2075, lon: -116.1, lat: 51.45 },
  { d: 200, e: 2050, lon: -116.1, lat: 51.45 },
  { d: 300, e: 2025, lon: -116.1, lat: 51.45 },
  { d: 400, e: 2000, lon: -116.1, lat: 51.45 },
];

describe("profileGeometry", () => {
  it("maps distance across and elevation down, top of the run at the top left", () => {
    const g = profileGeometry(fixture, 400, 100);
    expect(g.line).toBe("M0 0 L100 25 L200 50 L300 75 L400 100");
    expect(g.topM).toBe(2100);
    expect(g.bottomM).toBe(2000);
    expect(g.lengthM).toBe(400);
  });

  it("closes the area down to the baseline and back", () => {
    const g = profileGeometry(fixture, 400, 100);
    expect(g.area).toBe(`${g.line} L400 100 L0 100 Z`);
  });

  it("scales to whatever box it is given", () => {
    const g = profileGeometry(fixture, 200, 50);
    expect(g.line).toBe("M0 0 L50 12.5 L100 25 L150 37.5 L200 50");
  });

  it("draws an uphill section as a rise, not as a descent", () => {
    // Several baked runs climb before they drop; vertical_m is a max−min.
    const undulating: ProfileSample[] = [
      { d: 0, e: 2000, lon: 0, lat: 0 },
      { d: 100, e: 2100, lon: 0, lat: 0 },
      { d: 200, e: 2000, lon: 0, lat: 0 },
    ];
    const g = profileGeometry(undulating, 200, 100);
    expect(g.line).toBe("M0 100 L100 0 L200 100");
    expect(g.topM).toBe(2100);
    expect(g.bottomM).toBe(2000);
  });

  it("draws a dead-flat run along the middle instead of dividing by zero", () => {
    const flat: ProfileSample[] = [
      { d: 0, e: 2000, lon: 0, lat: 0 },
      { d: 100, e: 2000, lon: 0, lat: 0 },
    ];
    const g = profileGeometry(flat, 100, 40);
    expect(g.line).toBe("M0 20 L100 20");
  });

  it("draws nothing for a profile with fewer than two samples", () => {
    expect(profileGeometry([], 100, 40).line).toBe("");
    expect(profileGeometry([fixture[0]], 100, 40).line).toBe("");
  });
});

describe("every baked Lake Louise run", () => {
  const file: RunsFile = JSON.parse(
    readFileSync(new URL("../public/resorts/lake-louise/runs.json", import.meta.url), "utf8"),
  );

  it("produces a finite path that stays inside its box", () => {
    for (const run of file.runs) {
      const g = profileGeometry(run.profile, 600, 160);
      expect(g.line).not.toBe("");
      expect(g.line).not.toMatch(/NaN|Infinity/);

      for (const [, xs, ys] of g.line.matchAll(/([\d.-]+) ([\d.-]+)/g)) {
        expect(Number(xs)).toBeGreaterThanOrEqual(0);
        expect(Number(xs)).toBeLessThanOrEqual(600);
        expect(Number(ys)).toBeGreaterThanOrEqual(0);
        expect(Number(ys)).toBeLessThanOrEqual(160);
      }
    }
  });
});
