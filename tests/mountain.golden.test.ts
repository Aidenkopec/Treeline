import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ASPECT_LABELS } from "@/lib/aspect";
import type { Manifest, MountainFile } from "@/lib/types";

/**
 * The committed Lake Louise lift and place artifact, asserted as shipped rather
 * than as recomputed. A bake change that quietly grew a field or resampled a
 * polyline would pass a derivation test and fail here, which is the point.
 *
 * **Independent verification.** Lift length is checked against physics rather
 * than against this pipeline's own output: OSM tags each lift's advertised ride
 * time, and baked length divided by that time has to come out at a speed real
 * cable actually runs at. Measured on the committed artifact:
 *
 *   Glacier Express            5.59 m/s   detachable
 *   Top of the World Express   4.94 m/s   detachable
 *   Juniper Express            4.94 m/s   detachable
 *   Richardson's Ridge Express 5.18 m/s   detachable
 *   Larch Express              4.45 m/s   detachable
 *   Summit                     2.40 m/s   fixed-grip
 *   Paradise                   2.38 m/s   fixed-grip
 *   Ptarmigan                  2.23 m/s   fixed-grip
 *
 * Detachable lifts run near 5 m/s and fixed-grip near 2.3–2.5; the split above
 * matches which lifts at Lake Louise are which, and the three slow ones are the
 * three fixed-grip ones. A length wrong by even fifteen percent would put
 * several of these outside what cable does. The band asserted below is wide on
 * purpose — it is there to catch a transposed axis or a broken projection, not
 * to claim the ride times are accurate to the second.
 *
 * Two things deliberately left open rather than asserted wrongly:
 *
 * - **Grizzly Express Gondola** rises 713m over 2862m, monotonically, from
 *   1657m to 2371m. That is a longer alignment than the operator's published
 *   figure for the gondola describes. The geometry is internally consistent and
 *   the rise is monotonic, so this is a question about what OSM has mapped, not
 *   about the arithmetic. It is not fudged to match a brochure.
 * - **Richardson's Ridge Express** carries 3 towers over 1739m. That is a
 *   sparse alignment for a lift still under construction, and it will redraw
 *   itself as OSM fills in.
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
 * The §8 pin, and the reason this file exists.
 *
 * Slope data attaches to marked runs. The ground under a cable is not a marked
 * run, so a lift that grew a pitch or an aspect would be publishing the angle
 * of unpatrolled terrain through an infrastructure feature. Asserted over the
 * artifact's own keys, so it holds whatever a future bake decides to add.
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
    // Belt and braces: a label smuggled in as a value would read as terrain
    // data on the page just as loudly as a field called `aspect_deg`.
    const serialised = JSON.stringify(mountain);
    // Walked from `ASPECT_LABELS` rather than a copy of it, so a ninth aspect
    // is covered here the day it is added.
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
    // Top of the World Express is mapped with 14 nodes, 12 of them tagged
    // aerialway=pylon. A resampled line would land on a round number instead.
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
      // Slowest fixed-grip to fastest detachable, with room either side. A
      // broken projection or a doubled length leaves this band immediately.
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
    // Whitehorn Mountain is published at 2637m and this 30m model resamples it
    // to about 2597. That gap is the documented reason `ele_m` exists, and a
    // bake that started overwriting one with the other would close it.
    const peak = mountain.places.find((p) => p.name === "Whitehorn Mountain")!;
    expect(peak.ele_m).toBe(2637);
    expect(peak.surface_m).toBeLessThan(peak.ele_m!);
    expect(peak.ele_m! - peak.surface_m).toBeLessThan(120);
  });

  it("is an array even where a resort has nothing named, rather than a missing key", () => {
    expect(Array.isArray(mountain.places)).toBe(true);
  });
});
