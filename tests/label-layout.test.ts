import { describe, expect, it } from "vitest";
import {
  clusterPoints,
  placePlates,
  type PlateCandidate,
  type Rect,
  sameRects,
  type ScreenPoint,
} from "@/lib/label-layout";

function point(id: string, x: number, y: number): ScreenPoint {
  return { id, x, y };
}

function plate(
  id: string,
  x: number,
  y: number,
  over: Partial<PlateCandidate> = {},
): PlateCandidate {
  return {
    id,
    width: 100,
    height: 16,
    spots: [
      { x, y: y - 20 },
      { x, y: y + 20 },
    ],
    ...over,
  };
}

describe("clusterPoints", () => {
  it("leaves points further apart than the radius alone", () => {
    const groups = clusterPoints([point("a", 0, 0), point("b", 100, 0)], 30);
    expect(groups.map((group) => group.ids)).toEqual([["a"], ["b"]]);
  });

  it("merges a crowd into one group", () => {
    // Lake Louise's five base-area lodges, which is the case this exists for.
    const groups = clusterPoints(
      [point("a", 0, 0), point("b", 8, 2), point("c", 3, 9), point("d", 12, 5), point("e", 6, 6)],
      30,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].ids).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("links a chain whose ends are further apart than the radius", () => {
    const groups = clusterPoints([point("a", 0, 0), point("b", 20, 0), point("c", 40, 0)], 30);
    expect(groups).toHaveLength(1);
    expect(groups[0].ids).toEqual(["a", "b", "c"]);
  });

  it("hangs the group on the member nearest its centre", () => {
    const groups = clusterPoints([point("a", 0, 0), point("b", 10, 0), point("c", 20, 0)], 30);
    expect(groups[0].anchorId).toBe("b");
  });

  it("moves the anchor without moving the membership", () => {
    // The same three places stay one chain as the camera turns, but a
    // different one becomes nearest the centre. Anything caching a mark on
    // membership alone keeps drawing it on the building it left behind.
    const before = clusterPoints([point("a", 0, 0), point("b", 10, 0), point("c", 20, 0)], 30);
    const after = clusterPoints([point("a", 0, 0), point("b", 10, 0), point("c", -20, 0)], 30);

    expect(after[0].ids).toEqual(before[0].ids);
    expect(after[0].anchorId).not.toBe(before[0].anchorId);
  });

  it("orders groups by their first member, so one camera always yields one answer", () => {
    const groups = clusterPoints([point("far", 500, 0), point("a", 0, 0), point("b", 4, 0)], 30);
    expect(groups.map((group) => group.anchorId)).toEqual(["far", "a"]);
  });

  it("returns nothing for nothing", () => {
    expect(clusterPoints([], 30)).toEqual([]);
  });
});

describe("placePlates", () => {
  it("gives the first candidate its first choice", () => {
    expect(placePlates([plate("a", 100, 100)], [])).toEqual([
      { id: "a", spot: 0, rect: { x: 50, y: 72, width: 100, height: 16 } },
    ]);
  });

  it("flips a candidate to its other side when the first is taken", () => {
    const placed = placePlates([plate("a", 100, 100), plate("b", 100, 110)], []);
    expect(placed.map(({ id, spot }) => ({ id, spot }))).toEqual([
      { id: "a", spot: 0 },
      { id: "b", spot: 1 },
    ]);
  });

  it("drops a candidate with nowhere left to go", () => {
    const placed = placePlates(
      [plate("a", 100, 100), plate("b", 100, 110), plate("c", 100, 102)],
      [],
    );
    expect(placed.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("never places over a reserved rect", () => {
    // A place mark already standing where the plate's first choice would land.
    const reserved: Rect[] = [{ x: 50, y: 72, width: 100, height: 16 }];
    expect(
      placePlates([plate("a", 100, 100)], reserved).map(({ id, spot }) => ({ id, spot })),
    ).toEqual([{ id: "a", spot: 1 }]);
  });

  it("places in the order given, which is the order of importance", () => {
    // Same two candidates, opposite order: whichever comes first wins the side.
    const placed = placePlates([plate("b", 100, 110), plate("a", 100, 100)], []);
    expect(placed.map(({ id, spot }) => ({ id, spot }))).toEqual([
      { id: "b", spot: 0 },
      { id: "a", spot: 1 },
    ]);
  });

  it("slides a candidate along its line rather than dropping it", () => {
    // Both places beside the cable's middle are taken, so the name moves up the
    // cable instead of coming off the mountain.
    const slider: PlateCandidate = {
      id: "b",
      width: 100,
      height: 16,
      spots: [
        { x: 100, y: 80 },
        { x: 100, y: 84 },
        { x: 400, y: 80 },
      ],
    };
    const placed = placePlates([plate("a", 100, 100), slider], []);
    expect(placed.map(({ id, spot }) => ({ id, spot }))).toEqual([
      { id: "a", spot: 0 },
      { id: "b", spot: 2 },
    ]);
  });

  it("takes a candidate with no spots nowhere", () => {
    expect(placePlates([plate("a", 100, 100, { spots: [] })], [])).toEqual([]);
  });
});

describe("sameRects", () => {
  const one = { x: 0, y: 0, width: 10, height: 10 };

  it("holds for the same numbers in new objects", () => {
    expect(sameRects([one], [{ ...one }])).toBe(true);
  });

  it("fails on a different count", () => {
    expect(sameRects([one], [one, one])).toBe(false);
  });

  it("fails on any moved edge", () => {
    expect(sameRects([one], [{ ...one, x: 1 }])).toBe(false);
    expect(sameRects([one], [{ ...one, height: 11 }])).toBe(false);
  });

  it("holds for two empties", () => {
    expect(sameRects([], [])).toBe(true);
  });
});
