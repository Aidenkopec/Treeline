import { describe, expect, it } from "vitest";
import { haversineM } from "@/scripts/bake/runs";

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
 * SPEC §6: pitch and aspect for two hand-checked Lake Louise runs are committed
 * as golden values, asserted to a tolerance rather than exactly — the DEM is
 * 30m data and a precision claim beyond that would be false.
 *
 * Skipped until phase 1 bakes Lake Louise for real. The values must be checked
 * by hand against the published trail map and a topo before they are committed;
 * a golden captured from this pipeline's own first output would only prove the
 * pipeline agrees with itself.
 */
describe.skip("golden run stats — Lake Louise", () => {
  it("derives pitch and aspect for a hand-checked run", () => {
    expect.fail("Awaiting phase 1: bake Lake Louise, then hand-check two runs.");
  });
});
