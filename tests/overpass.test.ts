import { describe, expect, it } from "vitest";
import {
  downhillRunsQuery,
  isInboundsDownhill,
  type OverpassWay,
  readDifficulty,
  resortBoundsQuery,
} from "@/scripts/bake/overpass";
import fixture from "./fixtures/overpass-mixed-pistes.json" with { type: "json" };

const ways = fixture.elements as unknown as OverpassWay[];

/**
 * The downhill-only filter is a safety rule (SPEC §8), so it is tested as one:
 * against a fixture that actually contains the ways it must reject. A test fed
 * only valid input would pass just as happily with no filter at all.
 */
describe("inbounds downhill filter", () => {
  it("keeps marked downhill runs", () => {
    const kept = ways.filter(isInboundsDownhill).map((w) => w.id);
    expect(kept).toContain(1001);
    expect(kept).toContain(1002);
  });

  it("rejects backcountry ways", () => {
    const backcountry = ways.find((w) => w.id === 2001)!;
    expect(isInboundsDownhill(backcountry)).toBe(false);
  });

  it("rejects skitour ways", () => {
    const skitour = ways.find((w) => w.id === 2002)!;
    expect(isInboundsDownhill(skitour)).toBe(false);
  });

  it("rejects nordic and every other piste type", () => {
    const nordic = ways.find((w) => w.id === 2003)!;
    expect(isInboundsDownhill(nordic)).toBe(false);
  });

  it("rejects a way tagged downhill *and* skitour", () => {
    // A dual-tagged way is still unpatrolled touring terrain. Accepting it
    // because one of its tags says downhill is exactly the hole this closes.
    const dual = ways.find((w) => w.id === 2004)!;
    expect(isInboundsDownhill(dual)).toBe(false);
  });

  it("rejects an untagged way", () => {
    expect(isInboundsDownhill({ type: "way", id: 9999 })).toBe(false);
  });

  it("lets nothing unpatrolled through the fixture as a whole", () => {
    const kept = ways.filter(isInboundsDownhill);
    expect(kept).toHaveLength(3);
    for (const way of kept) {
      expect(way.tags?.["piste:type"]).toBe("downhill");
    }
  });
});

describe("difficulty reading", () => {
  it("reads a known grade", () => {
    expect(readDifficulty(ways.find((w) => w.id === 1001)!)).toBe("advanced");
  });

  it("returns null for an untagged run rather than guessing a grade", () => {
    expect(readDifficulty(ways.find((w) => w.id === 1002)!)).toBeNull();
  });

  it("returns null for a grade outside the rendered set", () => {
    expect(readDifficulty(ways.find((w) => w.id === 3001)!)).toBeNull();
  });
});

describe("query construction", () => {
  it("asks Overpass for downhill pistes and nothing else", () => {
    const query = downhillRunsQuery({ west: -116.25, south: 51.4, east: -116.05, north: 51.5 });
    expect(query).toContain('["piste:type"="downhill"]');
    expect(query).not.toContain("backcountry");
    expect(query).not.toContain("skitour");
  });

  it("orders the bbox south,west,north,east as Overpass expects", () => {
    const query = downhillRunsQuery({ west: -116.25, south: 51.4, east: -116.05, north: 51.5 });
    expect(query).toContain("51.4,-116.25,51.5,-116.05");
  });

  it("looks up resort bounds by winter sports landuse", () => {
    expect(resortBoundsQuery(51.4419, -116.1622)).toContain('["landuse"="winter_sports"]');
  });
});
