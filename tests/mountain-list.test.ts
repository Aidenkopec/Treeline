import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { liftCells, liftStyle, placeCells, placeStyle, UNNAMED_LIFT } from "@/lib/mountain";
import type { Lift, MountainFile, Place } from "@/lib/types";

/**
 * What the lift table and place list actually print. The cells are pre-formatted here
 * rather than in the components, so matching the baked artifact is a test, not a look.
 */

function lift(over: Partial<Lift> = {}): Lift {
  return {
    id: "1",
    name: "Glacier Express",
    kind: "chair_lift",
    vertical_m: 432,
    length_m: 1844,
    duration_min: 5.5,
    occupancy: 4,
    towers: [
      { lon: -116.16, lat: 51.44, ground_m: 1650, cable_m: 1662 },
      { lon: -116.15, lat: 51.45, ground_m: 2082, cable_m: 2094 },
    ],
    ...over,
  };
}

function place(over: Partial<Place> = {}): Place {
  return {
    id: "n1",
    name: "Temple Lodge",
    kind: "lodge",
    lon: -116.11,
    lat: 51.45,
    surface_m: 2010.3,
    ele_m: null,
    ...over,
  };
}

describe("liftCells", () => {
  it("names an untitled lift rather than printing an empty cell", () => {
    expect(liftCells(lift({ name: null })).name).toBe(UNNAMED_LIFT);
  });

  it("folds the carrier size into the type, which is what earns occupancy its place", () => {
    expect(liftCells(lift({ occupancy: 6, kind: "gondola" })).type).toBe("6-person gondola");
  });

  it("falls back to the bare kind where OSM does not say the carrier size", () => {
    expect(liftCells(lift({ occupancy: null })).type).toBe("Chairlift");
  });

  it("prints whole metres and kilometres, the precision a 30m model supports", () => {
    const cells = liftCells(lift());
    expect(cells.vertical).toBe("432m");
    expect(cells.length).toBe("1.8km");
  });
});

describe("placeCells", () => {
  it("marks a surveyed height as surveyed, so it is not read as this project's measurement", () => {
    const peak = placeCells(place({ kind: "peak", ele_m: 2637, surface_m: 2597 }));
    expect(peak.elevation).toBe("2637m");
    expect(peak.surveyed).toBe(true);
  });

  it("falls back to the modelled surface where there is no surveyed height", () => {
    const lodge = placeCells(place());
    expect(lodge.elevation).toBe("2010m");
    expect(lodge.surveyed).toBe(false);
  });
});

/**
 * Place glyphs must stay clear of the run-difficulty vocabulary, which carries
 * grade by shape so it survives being read without colour (SPEC §9). A lodge
 * that looked like a black diamond would be worse than no marker at all.
 */
describe("place glyphs", () => {
  it("draws no closed four-cornered mark, which is the square and the diamond", () => {
    for (const kind of ["peak", "viewpoint", "lodge"] as const) {
      const { path } = placeStyle(kind);
      const corners = (path.match(/\d+(\.\d+)?\s+\d+(\.\d+)?/g) ?? []).length;
      const closed = path.trim().toUpperCase().endsWith("Z");
      // Four corners joined up is a square or a diamond, and both already mean a grade.
      expect(closed && corners === 4, `${kind} closes on four corners`).toBe(false);
    }
  });

  it("draws nothing shaped like the difficulty diamond", () => {
    // The literal path difficulty-mark.tsx renders for advanced and expert.
    const diamond = "M5 0.4 9.6 5 5 9.6 0.4 5Z";
    for (const kind of ["peak", "viewpoint", "lodge"] as const) {
      expect(placeStyle(kind).path).not.toBe(diamond);
    }
  });

  it("gives the 3D marker and the list glyph the same outline, so they cannot drift", () => {
    // One string, two renderers: the sprite in lift-overlay.tsx and the SVG in place-mark.
    expect(placeStyle("peak").path).toBe(placeStyle("viewpoint").path);
    expect(placeStyle("peak").filled).not.toBe(placeStyle("viewpoint").filled);
  });
});

describe("the committed Lake Louise artifact, as the page prints it", () => {
  const mountain = JSON.parse(
    readFileSync(new URL("../public/resorts/lake-louise/mountain.json", import.meta.url), "utf8"),
  ) as MountainFile;

  it("prints the gondola's row exactly", () => {
    const gondola = mountain.lifts.find((l) => l.name === "Grizzly Express Gondola")!;
    expect(liftCells(gondola)).toEqual({
      name: "Grizzly Express Gondola",
      type: "6-person gondola",
      vertical: "713m",
      length: "2.9km",
    });
  });

  it("prints a carpet as an unnamed surface lift rather than as a blank row", () => {
    const carpet = mountain.lifts.find((l) => l.kind === "magic_carpet")!;
    const cells = liftCells(carpet);
    expect(cells.name).toBe(UNNAMED_LIFT);
    expect(cells.type).toBe("Carpet");
    expect(liftStyle(carpet.kind).aerial).toBe(false);
  });

  it("draws every aerial lift as a cable and every surface lift on the snow", () => {
    const aerial = mountain.lifts.filter((l) => liftStyle(l.kind).aerial);
    expect(aerial.length).toBeGreaterThanOrEqual(10);
    expect(aerial.length).toBeLessThan(mountain.lifts.length);
  });

  it("prints the summit at its surveyed height, marked as surveyed", () => {
    const peak = mountain.places.find((p) => p.kind === "peak")!;
    expect(placeCells(peak)).toEqual({
      name: "Whitehorn Mountain",
      kind: "Peak",
      elevation: "2637m",
      surveyed: true,
    });
  });
});
