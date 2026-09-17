import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { haversineM } from "@/scripts/bake/runs";
import { aspectLabel } from "@/lib/aspect";
import type { Manifest, RunsFile } from "@/lib/types";

describe("great-circle distance", () => {
  it("is zero for a point against itself", () => {
    expect(haversineM(-116.16, 51.44, -116.16, 51.44)).toBe(0);
  });

  it("measures a degree of latitude at roughly 111km", () => {
    expect(haversineM(-116.16, 51.0, -116.16, 52.0)).toBeCloseTo(111195, -2);
  });

  it("shrinks a degree of longitude with latitude", () => {
    const atEquator = haversineM(0, 0, 1, 0);
    const atLakeLouise = haversineM(-116.16, 51.4419, -115.16, 51.4419);
    expect(atLakeLouise).toBeLessThan(atEquator);
    expect(atLakeLouise / atEquator).toBeCloseTo(Math.cos((51.4419 * Math.PI) / 180), 3);
  });
});

/**
 * SPEC §6: pitch and aspect for two hand-checked Lake Louise runs, against Copernicus DEM
 * GLO-90 rather than this pipeline's own output (the comparison is in PHASES.md). The
 * tolerances are wide on purpose: they catch a sign error or a transposed axis, not drift.
 */
describe("golden run stats — Lake Louise", () => {
  const golden = [
    {
      name: "Wiwaxy",
      id: "23301816",
      difficulty: "easy",
      vertical_m: 359,
      length_m: 2254,
      pitch_avg_deg: 9.2,
      aspect_deg: 220,
      aspect_label: "SW",
    },
    {
      name: "Eagles Flight",
      id: "656592592",
      difficulty: "advanced",
      vertical_m: 261,
      length_m: 731,
      pitch_avg_deg: 21,
      aspect_deg: 223,
      aspect_label: "SW",
    },
  ] as const;

  const runs = (
    JSON.parse(
      readFileSync(new URL("../public/resorts/lake-louise/runs.json", import.meta.url), "utf8"),
    ) as RunsFile
  ).runs;

  for (const expected of golden) {
    describe(expected.name, () => {
      const run = runs.find((r) => r.id === expected.id);

      it("is in the baked output", () => {
        expect(run, `way ${expected.id} missing from runs.json`).toBeDefined();
        expect(run?.name).toBe(expected.name);
      });

      it("transcribes its OSM grade exactly", () => {
        // Not derived, so no tolerance applies.
        expect(run?.difficulty).toBe(expected.difficulty);
      });

      it("measures vertical and length within what a 30m DEM supports", () => {
        expect(Math.abs(run!.vertical_m - expected.vertical_m)).toBeLessThanOrEqual(50);
        expect(Math.abs(run!.length_m - expected.length_m) / expected.length_m).toBeLessThanOrEqual(
          0.1,
        );
      });

      it("measures pitch within tolerance of an independent DEM", () => {
        expect(Math.abs(run!.pitch_avg_deg - expected.pitch_avg_deg)).toBeLessThanOrEqual(5);
        expect(run!.pitch_max_deg).toBeGreaterThan(0);
        expect(run!.pitch_max_deg).toBeLessThan(60);
      });

      it("faces the direction the trail map shows", () => {
        // Angular distance, so 359° and 1° are 2° apart rather than 358°.
        const delta = Math.abs(((run!.aspect_deg - expected.aspect_deg + 540) % 360) - 180);
        expect(delta).toBeLessThanOrEqual(25);
        expect(run!.aspect_label).toBe(expected.aspect_label);
      });
    });
  }
});

/**
 * Structural invariants over every baked run, catching what a two-run golden cannot: a
 * broken projection, a sign flip, a profile built backwards. Deliberately absent is
 * `pitch_avg <= pitch_max`, which looks obvious and is false on an undulating run.
 */
describe("every baked Lake Louise run", () => {
  const file = JSON.parse(
    readFileSync(new URL("../public/resorts/lake-louise/runs.json", import.meta.url), "utf8"),
  ) as RunsFile;
  const manifest = JSON.parse(
    readFileSync(new URL("../public/resorts/manifest.json", import.meta.url), "utf8"),
  ) as Manifest;
  const resort = manifest.resorts.find((r) => r.slug === "lake-louise")!;

  it("covers the resort", () => {
    // Not `=== 168`: OSM is edited continuously and a re-bake will drift.
    expect(file.runs.length).toBeGreaterThanOrEqual(100);
    expect(new Set(file.runs.map((r) => r.id)).size).toBe(file.runs.length);
  });

  it("starts every profile at the top and descends", () => {
    for (const run of file.runs) {
      expect(run.profile.length).toBeGreaterThan(0);
      expect(run.profile[0].d).toBe(0);
      for (let i = 1; i < run.profile.length; i++) {
        expect(run.profile[i].d).toBeGreaterThan(run.profile[i - 1].d);
      }
    }
  });

  it("keeps every number inside what the terrain can produce", () => {
    const relief = resort.elevation_max_m - resort.elevation_min_m;
    for (const run of file.runs) {
      expect(run.vertical_m).toBeGreaterThanOrEqual(0);
      expect(run.vertical_m).toBeLessThanOrEqual(relief);
      expect(run.pitch_avg_deg).toBeGreaterThanOrEqual(0);
      expect(run.pitch_avg_deg).toBeLessThan(60);
      expect(run.pitch_max_deg).toBeLessThan(60);
      expect(run.aspect_deg).toBeGreaterThanOrEqual(0);
      expect(run.aspect_deg).toBeLessThan(360);
    }
  });

  it("labels every aspect the same way the UI will", () => {
    // Shared with lib/aspect.ts, so a bucket and its label can never disagree.
    for (const run of file.runs) {
      expect(run.aspect_label).toBe(aspectLabel(run.aspect_deg));
    }
  });

  it("keeps every profile point inside the baked heightmap", () => {
    for (const run of file.runs) {
      for (const p of run.profile) {
        expect(p.lon).toBeGreaterThanOrEqual(resort.bounds.west);
        expect(p.lon).toBeLessThanOrEqual(resort.bounds.east);
        expect(p.lat).toBeGreaterThanOrEqual(resort.bounds.south);
        expect(p.lat).toBeLessThanOrEqual(resort.bounds.north);
      }
    }
  });
});
