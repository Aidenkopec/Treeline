import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aspectLabel } from "@/lib/aspect";
import {
  NO_FILTER,
  UNNAMED_RUN,
  filterRuns,
  matchesFilter,
  runCells,
  sortRuns,
} from "@/lib/run-list";
import type { RunFilter } from "@/lib/run-list";
import type { Run, RunsFile } from "@/lib/types";

function run(over: Partial<Run> = {}): Run {
  return {
    id: "1",
    name: "Test",
    difficulty: "intermediate",
    vertical_m: 200,
    length_m: 1000,
    pitch_avg_deg: 15,
    pitch_max_deg: 25,
    aspect_deg: 90,
    aspect_label: "E",
    profile: [],
    ...over,
  };
}

describe("matchesFilter", () => {
  it("treats an empty list as no constraint, not as nothing selected", () => {
    expect(matchesFilter(run(), NO_FILTER)).toBe(true);
  });

  it("keeps only the chosen aspects", () => {
    expect(matchesFilter(run({ aspect_label: "E" }), { ...NO_FILTER, aspects: ["N", "E"] })).toBe(
      true,
    );
    expect(matchesFilter(run({ aspect_label: "S" }), { ...NO_FILTER, aspects: ["N", "E"] })).toBe(
      false,
    );
  });

  it("selects untagged ways with a null grade rather than by their absence", () => {
    const untagged = { ...NO_FILTER, difficulties: [null] };
    expect(matchesFilter(run({ difficulty: null }), untagged)).toBe(true);
    expect(matchesFilter(run({ difficulty: "expert" }), untagged)).toBe(false);
  });

  it("includes a run sitting exactly on the minimum vertical", () => {
    const filter = { ...NO_FILTER, minVerticalM: 200 };
    expect(matchesFilter(run({ vertical_m: 200 }), filter)).toBe(true);
    expect(matchesFilter(run({ vertical_m: 199 }), filter)).toBe(false);
  });

  it("requires every criterion at once", () => {
    const filter: RunFilter = { aspects: ["E"], difficulties: ["expert"], minVerticalM: 100 };
    expect(matchesFilter(run({ aspect_label: "E", difficulty: "expert" }), filter)).toBe(true);
    expect(matchesFilter(run({ aspect_label: "E", difficulty: "easy" }), filter)).toBe(false);
    expect(matchesFilter(run({ aspect_label: "N", difficulty: "expert" }), filter)).toBe(false);
    expect(
      matchesFilter(run({ aspect_label: "E", difficulty: "expert", vertical_m: 50 }), filter),
    ).toBe(false);
  });
});

describe("filterRuns", () => {
  it("leaves the source array alone", () => {
    const runs = [run({ id: "a", vertical_m: 10 }), run({ id: "b", vertical_m: 300 })];
    expect(filterRuns(runs, { ...NO_FILTER, minVerticalM: 100 })).toHaveLength(1);
    expect(runs).toHaveLength(2);
  });
});

describe("sortRuns", () => {
  it("orders aspect around the compass, not by degrees", () => {
    // 350° is north. Sorted numerically it would land after west, which would
    // split the N bucket across both ends of the column.
    const north = run({ id: "n", aspect_deg: 350, aspect_label: aspectLabel(350) });
    const west = run({ id: "w", aspect_deg: 270, aspect_label: "W" });

    expect(north.aspect_label).toBe("N");
    expect(sortRuns([west, north], "aspect", "asc").map((r) => r.id)).toEqual(["n", "w"]);
  });

  it("sinks unnamed runs to the bottom whichever way the column points", () => {
    const runs = [run({ id: "x", name: null }), run({ id: "a", name: "Aardvark" })];
    expect(sortRuns(runs, "name", "asc").map((r) => r.id)).toEqual(["a", "x"]);
    expect(sortRuns(runs, "name", "desc").map((r) => r.id)).toEqual(["a", "x"]);
  });

  it("sinks untagged grades to the bottom the same way", () => {
    const runs = [run({ id: "u", difficulty: null }), run({ id: "e", difficulty: "easy" })];
    expect(sortRuns(runs, "difficulty", "asc").map((r) => r.id)).toEqual(["e", "u"]);
    expect(sortRuns(runs, "difficulty", "desc").map((r) => r.id)).toEqual(["e", "u"]);
  });

  it("orders grades as the mountain does, not alphabetically", () => {
    const runs = [
      run({ id: "3", difficulty: "expert" }),
      run({ id: "1", difficulty: "easy" }),
      run({ id: "2", difficulty: "advanced" }),
    ];
    expect(sortRuns(runs, "difficulty", "asc").map((r) => r.id)).toEqual(["1", "2", "3"]);
  });

  it("breaks ties on id, so re-sorting never reshuffles equal rows", () => {
    const runs = [
      run({ id: "c", vertical_m: 100 }),
      run({ id: "a", vertical_m: 100 }),
      run({ id: "b", vertical_m: 100 }),
    ];
    expect(sortRuns(runs, "vertical_m", "asc").map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(sortRuns(runs, "vertical_m", "desc").map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("reverses the numeric columns", () => {
    const runs = [run({ id: "a", pitch_avg_deg: 5 }), run({ id: "b", pitch_avg_deg: 25 })];
    expect(sortRuns(runs, "pitch_avg_deg", "asc").map((r) => r.id)).toEqual(["a", "b"]);
    expect(sortRuns(runs, "pitch_avg_deg", "desc").map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("leaves the source array alone", () => {
    const runs = [run({ id: "b" }), run({ id: "a" })];
    sortRuns(runs, "name", "asc");
    expect(runs.map((r) => r.id)).toEqual(["b", "a"]);
  });
});

/**
 * The phase gate — "stats in UI match runs.json" — as a test rather than an eye.
 *
 * Read straight out of the committed artifact, so a change to the bake, to the
 * formatters or to the cells has to be looked at rather than discovered on the
 * page.
 */
describe("runCells against the committed Lake Louise artifact", () => {
  const file: RunsFile = JSON.parse(
    readFileSync(new URL("../public/resorts/lake-louise/runs.json", import.meta.url), "utf8"),
  );
  const byId = (id: string) => file.runs.find((r) => r.id === id)!;

  it("prints a long green traverse the way the data reads", () => {
    const pika = byId("23301427");
    expect(pika.name).toBe("Pika");
    expect(runCells(pika)).toEqual({
      name: "Pika",
      vertical: "377m",
      length: "3.1km",
      // runs.json carries 7.3; lib/format caps precision at what 30m data supports.
      pitchAvg: "7°",
      pitchMax: "17°",
      aspect: "E 112°",
    });
  });

  it("prints a short intermediate in metres, not kilometres", () => {
    const old = byId("23301429");
    expect(runCells(old)).toEqual({
      name: "Old Ptarmigan",
      vertical: "268m",
      length: "1.2km",
      pitchAvg: "13°",
      pitchMax: "24°",
      aspect: "E 105°",
    });
  });

  it("names the unnamed ways instead of leaving a hole in the column", () => {
    const unnamed = file.runs.filter((r) => r.name === null);
    expect(unnamed.length).toBeGreaterThan(0);
    for (const r of unnamed) expect(runCells(r).name).toBe(UNNAMED_RUN);
  });

  it("agrees with the aspect bucketing the bake used", () => {
    for (const r of file.runs) {
      expect(runCells(r).aspect.startsWith(aspectLabel(r.aspect_deg))).toBe(true);
    }
  });
});
