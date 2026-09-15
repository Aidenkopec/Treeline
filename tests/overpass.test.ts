import { describe, expect, it } from "vitest";
import {
  boundsFromElements,
  downhillRunsQuery,
  isInboundsDownhill,
  isUsableAnswer,
  mountainQuery,
  readDifficulty,
  resortBoundsQuery,
  type OverpassWay,
  unionBounds,
} from "@/scripts/bake/overpass";
import type { OverpassArea } from "@/scripts/bake/overpass";
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

describe("grade aliases", () => {
  it("reads novice as easy, the same green circle on a North American map", () => {
    const way = {
      type: "way" as const,
      id: 9001,
      tags: { "piste:type": "downhill", "piste:difficulty": "novice" },
    };
    expect(readDifficulty(way)).toBe("easy");
  });

  it("still refuses a grade this project does not render", () => {
    const way = {
      type: "way" as const,
      id: 9002,
      tags: { "piste:type": "downhill", "piste:difficulty": "extreme" },
    };
    expect(readDifficulty(way)).toBeNull();
  });
});

describe("resort bounds from OSM areas", () => {
  const anchor = { lat: 51.4419, lon: -116.1622 };

  const resort: OverpassArea = {
    type: "way",
    id: 1,
    geometry: [
      { lat: 51.4335, lon: -116.1654 },
      { lat: 51.475, lon: -116.0994 },
    ],
  };
  const neighbour: OverpassArea = {
    type: "way",
    id: 2,
    geometry: [
      { lat: 51.0, lon: -115.9 },
      { lat: 51.2, lon: -115.6 },
    ],
  };

  it("prefers the area containing the search anchor over a neighbouring one", () => {
    const bounds = boundsFromElements([neighbour, resort], anchor.lat, anchor.lon);
    expect(bounds).toEqual({ west: -116.1654, east: -116.0994, south: 51.4335, north: 51.475 });
  });

  it("reads a relation's geometry from its members", () => {
    const relation: OverpassArea = {
      type: "relation",
      id: 3,
      members: [
        { geometry: [{ lat: 51.44, lon: -116.17 }] },
        { geometry: [{ lat: 51.46, lon: -116.15 }] },
      ],
    };
    const bounds = boundsFromElements([relation], anchor.lat, anchor.lon);
    expect(bounds).toEqual({ west: -116.17, east: -116.15, south: 51.44, north: 51.46 });
  });

  it("is null when nothing came back", () => {
    expect(boundsFromElements([], anchor.lat, anchor.lon)).toBeNull();
  });

  it("grows bounds to take in points that fall outside them", () => {
    const grown = unionBounds({ west: -116.16, east: -116.1, south: 51.44, north: 51.46 }, [
      { lat: 51.47, lon: -116.2 },
    ]);
    expect(grown).toEqual({ west: -116.2, east: -116.1, south: 51.44, north: 51.47 });
  });
});

/**
 * A busy Overpass answers 200 and puts the failure in the body, so status code
 * alone cannot tell an answer from an outage. The download cache has no TTL and
 * no eviction, so whatever gets past this gate is what every later bake reads.
 */
describe("overpass answer gate", () => {
  it("rejects an HTML error page served with 200 rather than caching it forever", () => {
    const html = Buffer.from(
      "<html><body><p>Error: runtime error: open64: 0 Success /osm3s_osm_base " +
        "Dispatcher_Client::request_read_and_idx::timeout.</p></body></html>",
    );
    expect(isUsableAnswer(html)).toBe(false);
  });

  it("rejects a runtime-error remark rather than baking a resort with nothing on it", () => {
    // The dangerous shape: valid JSON, no exception anywhere, and a mountain
    // with no runs and no lifts that looks entirely healthy on the page.
    const remark = Buffer.from(
      JSON.stringify({ version: 0.6, elements: [], remark: "runtime error: Query timed out" }),
    );
    expect(isUsableAnswer(remark)).toBe(false);
  });

  it("accepts an answer with no elements, because an empty resort is a fact", () => {
    expect(isUsableAnswer(Buffer.from(JSON.stringify({ version: 0.6, elements: [] })))).toBe(true);
  });

  it("accepts an ordinary answer", () => {
    const body = Buffer.from(JSON.stringify({ elements: [{ type: "way", id: 1 }] }));
    expect(isUsableAnswer(body)).toBe(true);
  });
});

/**
 * The lifts and places query is separate from the runs query on purpose: the
 * downhill filter is a safety rule (§8), and a query with no piste clause in it
 * cannot widen one. That is a property worth asserting rather than trusting.
 */
describe("mountain query", () => {
  const query = mountainQuery(51.4419, -116.1622);

  it("asks for no piste of any kind, so it cannot widen the downhill filter", () => {
    expect(query).not.toContain("piste");
  });

  it("clips to the resort polygon rather than the mosaic, which reaches into the village", () => {
    expect(query).toContain("map_to_area");
    expect(query).toContain('["landuse"="winter_sports"]');
  });

  it("asks for lift geometry, not just a centre point, or there are no pylons to draw", () => {
    expect(query).toContain(".lifts out geom;");
  });

  it("asks for a centre on places, which is how a lodge mapped as a building gets a point", () => {
    expect(query).toContain(".places out center;");
  });
});
