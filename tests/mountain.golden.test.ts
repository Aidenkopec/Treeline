import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ASPECT_LABELS } from "@/lib/aspect";
import type { Manifest, MountainFile } from "@/lib/types";

/**
 * The committed Lake Louise lift and place artifact, asserted as shipped rather than as
 * recomputed: a bake that quietly grew a field or resampled a polyline fails here. Lift
 * length is checked against physics, not our own output; the speeds are in PHASES.md.
 */
const mountain = JSON.parse(
  readFileSync(new URL("../public/resorts/lake-louise/mountain.json", import.meta.url), "utf8"),
) as MountainFile;

const manifest = JSON.parse(
  readFileSync(new URL("../public/resorts/manifest.json", import.meta.url), "utf8"),
) as Manifest;

const resort = manifest.resorts.find((r) => r.slug === "lake-louise")!;
const relief = resort.elevation_max_m - resort.elevation_min_m;

/**
 * The §8 pin, and the reason this file exists. The ground under a cable is not a marked
 * run, so a lift that grew a pitch or an aspect would publish the angle of unpatrolled
 * terrain. Asserted over the artifact's own keys, so it holds whatever a future bake adds.
 */
describe("the committed Lake Louise mountain artifact", () => {
  it("attaches no pitch and no aspect to anything, which SPEC §8 gives to marked runs only", () => {
    const keys = new Set<string>();
    const walk = (value: unknown) => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (value === null || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        keys.add(key);
        walk(child);
      }
    };
    walk(mountain);

    expect(keys.size).toBeGreaterThan(0);
    for (const key of keys) expect(key).not.toMatch(/pitch|aspect/i);
  });

  it("names no aspect label anywhere in its values either, not just its keys", () => {
    // Belt and braces: a label smuggled in as a value reads as terrain data just as loudly.
    const serialised = JSON.stringify(mountain);
    // Walked from `ASPECT_LABELS`, so a ninth aspect is covered here the day it is added.
    for (const label of ASPECT_LABELS) expect(serialised).not.toContain(`"${label}"`);
  });
});

describe("every baked Lake Louise lift", () => {
  it("is there at all", () => {
    expect(mountain.lifts.length).toBeGreaterThanOrEqual(10);
  });

  it("has a unique id", () => {
    const ids = mountain.lifts.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("carries one tower per mapped OSM node rather than a resampled polyline", () => {
    // Mapped with 14 nodes, 12 tagged aerialway=pylon; a resampled line lands on a round one.
    const lift = mountain.lifts.find((l) => l.name === "Top of the World Express")!;
    expect(lift.towers).toHaveLength(14);
  });

  it("holds its cable a constant height above its own ground at every tower", () => {
    for (const lift of mountain.lifts) {
      const clearances = lift.towers.map((t) => Math.round((t.cable_m - t.ground_m) * 10) / 10);
      expect(new Set(clearances).size, `${lift.name ?? lift.id} varies its clearance`).toBe(1);
    }
  });

  it("climbs: every lift has at least two towers and rises from the first to the last", () => {
    for (const lift of mountain.lifts) {
      expect(lift.towers.length, `${lift.name ?? lift.id}`).toBeGreaterThanOrEqual(2);
      const first = lift.towers[0];
      const last = lift.towers[lift.towers.length - 1];
      expect(last.ground_m, `${lift.name ?? lift.id} runs downhill`).toBeGreaterThanOrEqual(
        first.ground_m,
      );
    }
  });

  it("keeps its vertical inside the relief the heightmap can produce", () => {
    for (const lift of mountain.lifts) {
      expect(lift.vertical_m, `${lift.name ?? lift.id}`).toBeGreaterThanOrEqual(0);
      expect(lift.vertical_m, `${lift.name ?? lift.id}`).toBeLessThanOrEqual(relief);
    }
  });

  it("stands every tower inside the baked heightmap", () => {
    for (const lift of mountain.lifts) {
      for (const t of lift.towers) {
        expect(t.lon).toBeGreaterThanOrEqual(resort.bounds.west);
        expect(t.lon).toBeLessThanOrEqual(resort.bounds.east);
        expect(t.lat).toBeGreaterThanOrEqual(resort.bounds.south);
        expect(t.lat).toBeLessThanOrEqual(resort.bounds.north);
      }
    }
  });

  it("runs its cable at a speed cable actually runs at, given the ride time OSM tags", () => {
    const timed = mountain.lifts.filter((l) => l.duration_min !== null && l.length_m > 200);
    expect(timed.length).toBeGreaterThanOrEqual(6);

    for (const lift of timed) {
      const speed = lift.length_m / (lift.duration_min! * 60);
      // Slowest fixed-grip to fastest detachable, with room either side.
      expect(speed, `${lift.name ?? lift.id} at ${speed.toFixed(2)} m/s`).toBeGreaterThan(1.5);
      expect(speed, `${lift.name ?? lift.id} at ${speed.toFixed(2)} m/s`).toBeLessThan(7);
    }
  });
});

describe("every baked Lake Louise place", () => {
  it("has a name, because a marker nobody can read is noise on the map", () => {
    for (const place of mountain.places) expect(place.name.length).toBeGreaterThan(0);
  });

  it("has a unique id across nodes and ways alike", () => {
    const ids = mountain.places.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("carries a surveyed height on a summit and nothing on a lodge", () => {
    const peak = mountain.places.find((p) => p.kind === "peak")!;
    expect(peak.ele_m).not.toBeNull();
    for (const lodge of mountain.places.filter((p) => p.kind === "lodge")) {
      expect(lodge.ele_m, `${lodge.name}`).toBeNull();
    }
  });

  it("reads a sharp summit low off the DEM, which is why the surveyed height is kept", () => {
    // Whitehorn is published at 2637m and this 30m model resamples it to about 2597.
    const peak = mountain.places.find((p) => p.name === "Whitehorn Mountain")!;
    expect(peak.ele_m).toBe(2637);
    expect(peak.surface_m).toBeLessThan(peak.ele_m!);
    expect(peak.ele_m! - peak.surface_m).toBeLessThan(120);
  });

  it("is an array even where a resort has nothing named, rather than a missing key", () => {
    expect(Array.isArray(mountain.places)).toBe(true);
  });
});
