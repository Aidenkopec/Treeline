import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { aspectLabel } from "@/lib/aspect";
import { DIFFICULTY_ORDER } from "@/lib/difficulty";
import {
  NO_FILTER,
  UNNAMED_RUN,
  filterRuns,
  isFiltered,
  matchesFilter,
  runCells,
  shownDifficulties,
  sortRuns,
  toggleDifficulty,
} from "@/lib/run-list";
import type { RunFilter } from "@/lib/run-list";
import type { Difficulty, Run, RunsFile } from "@/lib/types";

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
    const filter: RunFilter = {
      aspects: ["E"],
      difficulties: ["expert"],
      minVerticalM: 100,
      query: "",
    };
    expect(matchesFilter(run({ aspect_label: "E", difficulty: "expert" }), filter)).toBe(true);
    expect(matchesFilter(run({ aspect_label: "E", difficulty: "easy" }), filter)).toBe(false);
    expect(matchesFilter(run({ aspect_label: "N", difficulty: "expert" }), filter)).toBe(false);
    expect(
      matchesFilter(run({ aspect_label: "E", difficulty: "expert", vertical_m: 50 }), filter),
    ).toBe(false);
  });

  it("treats a blank query as no constraint, whitespace included", () => {
    expect(matchesFilter(run({ name: "Larch" }), { ...NO_FILTER, query: "" })).toBe(true);
    expect(matchesFilter(run({ name: "Larch" }), { ...NO_FILTER, query: "   " })).toBe(true);
  });

  it("matches part of a name, in any case", () => {
    const larch = run({ name: "Upper Larch" });
    expect(matchesFilter(larch, { ...NO_FILTER, query: "larch" })).toBe(true);
    expect(matchesFilter(larch, { ...NO_FILTER, query: "LARCH" })).toBe(true);
    expect(matchesFilter(larch, { ...NO_FILTER, query: "per lar" })).toBe(true);
    expect(matchesFilter(larch, { ...NO_FILTER, query: "birch" })).toBe(false);
  });

  it("reaches an accented name from a plain keyboard, and the other way round", () => {
    expect(matchesFilter(run({ name: "Annupuri" }), { ...NO_FILTER, query: "annupuri" })).toBe(
      true,
    );
    expect(matchesFilter(run({ name: "Ānnupuri" }), { ...NO_FILTER, query: "annupuri" })).toBe(
      true,
    );
    expect(matchesFilter(run({ name: "Annupuri" }), { ...NO_FILTER, query: "ānnupuri" })).toBe(
      true,
    );
  });

  it("searches an unnamed way by the name the table prints for it", () => {
    const anonymous = run({ name: null });
    expect(matchesFilter(anonymous, { ...NO_FILTER, query: "unnamed" })).toBe(true);
    expect(matchesFilter(anonymous, { ...NO_FILTER, query: "larch" })).toBe(false);
  });

  it("applies the query alongside the other criteria, not instead of them", () => {
    const filter: RunFilter = { ...NO_FILTER, difficulties: ["expert"], query: "gully" };
    expect(matchesFilter(run({ name: "Whitehorn Gully", difficulty: "expert" }), filter)).toBe(
      true,
    );
    expect(matchesFilter(run({ name: "Whitehorn Gully", difficulty: "easy" }), filter)).toBe(false);
    expect(matchesFilter(run({ name: "Meadowlark", difficulty: "expert" }), filter)).toBe(false);
  });
});

describe("filterRuns", () => {
  it("leaves the source array alone", () => {
    const runs = [run({ id: "a", vertical_m: 10 }), run({ id: "b", vertical_m: 300 })];
    expect(filterRuns(runs, { ...NO_FILTER, minVerticalM: 100 })).toHaveLength(1);
    expect(runs).toHaveLength(2);
  });
});

describe("isFiltered", () => {
  it("is false when nothing is constrained", () => {
    expect(isFiltered(NO_FILTER)).toBe(false);
  });

  it("is true for any one criterion on its own", () => {
    expect(isFiltered({ ...NO_FILTER, aspects: ["N"] })).toBe(true);
    expect(isFiltered({ ...NO_FILTER, difficulties: [null] })).toBe(true);
    expect(isFiltered({ ...NO_FILTER, minVerticalM: 1 })).toBe(true);
    expect(isFiltered({ ...NO_FILTER, query: "a" })).toBe(true);
  });

  it("reads a whitespace query as no constraint, the way matchesFilter does", () => {
    expect(isFiltered({ ...NO_FILTER, query: "   " })).toBe(false);
  });
});

describe("shownDifficulties and toggleDifficulty", () => {
  // What the chip row does: read the lit state, then click it.
  const click = (filter: RunFilter, difficulty: Difficulty) => ({
    wasLit: shownDifficulties(filter).includes(difficulty),
    next: toggleDifficulty(filter, difficulty),
  });

  it("shows every grade at rest, which is what lights every chip", () => {
    expect(shownDifficulties(NO_FILTER)).toEqual(DIFFICULTY_ORDER);
  });

  it("takes a grade away on the first click rather than selecting one", () => {
    const { wasLit, next } = click(NO_FILTER, "advanced");

    expect(wasLit).toBe(true);
    expect(next.difficulties).toEqual(["easy", "intermediate", "expert", null]);
    expect(shownDifficulties(next)).not.toContain("advanced");
  });

  it("always moves the chip it was clicked on", () => {
    // Switching off the last lit grade leaves it lit: it lights every other one too.
    let filter: RunFilter = NO_FILTER;

    for (const difficulty of [...DIFFICULTY_ORDER, ...DIFFICULTY_ORDER, "easy" as Difficulty]) {
      const lit = shownDifficulties(filter);
      const next = toggleDifficulty(filter, difficulty);
      const nextLit = shownDifficulties(next);

      if (lit.includes(difficulty) && lit.length === 1) {
        expect(nextLit).toEqual(DIFFICULTY_ORDER);
      } else {
        expect(nextLit.includes(difficulty)).toBe(!lit.includes(difficulty));
      }
      filter = next;
    }
  });

  it("wraps back to the whole mountain when the last lit grade goes out", () => {
    let filter: RunFilter = NO_FILTER;
    for (const difficulty of DIFFICULTY_ORDER.slice(0, 4)) {
      filter = toggleDifficulty(filter, difficulty);
    }
    expect(filter.difficulties).toEqual([null]);

    const cleared = toggleDifficulty(filter, null);
    expect(cleared.difficulties).toEqual([]);
    expect(isFiltered(cleared)).toBe(false);
  });

  it("writes a full selection back as the empty list, so nothing reads as filtered", () => {
    const one = toggleDifficulty(NO_FILTER, "easy");
    expect(isFiltered(one)).toBe(true);

    const all = toggleDifficulty(one, "easy");
    expect(all.difficulties).toEqual([]);
    expect(isFiltered(all)).toBe(false);
  });

  it("keeps the selection in grade order however it was reached", () => {
    const withoutEasy = toggleDifficulty(NO_FILTER, "easy");
    const withoutExpert = toggleDifficulty(withoutEasy, "expert");

    expect(toggleDifficulty(withoutExpert, "easy").difficulties).toEqual([
      "easy",
      "intermediate",
      "advanced",
      null,
    ]);
  });

  it("leaves the rest of the filter alone", () => {
    const filter: RunFilter = { ...NO_FILTER, aspects: ["N"], minVerticalM: 200, query: "larch" };

    expect(toggleDifficulty(filter, "easy")).toMatchObject({
      aspects: ["N"],
      minVerticalM: 200,
      query: "larch",
    });
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

  it("narrows the real list by name", () => {
    expect(filterRuns(file.runs, { ...NO_FILTER, query: "ptarmigan" })).toHaveLength(7);
    expect(filterRuns(file.runs, { ...NO_FILTER, query: "GULLY" })).toHaveLength(15);
    // The seven ways with no name, found by the string the table shows for them.
    expect(filterRuns(file.runs, { ...NO_FILTER, query: "unnamed" })).toHaveLength(7);
    expect(filterRuns(file.runs, { ...NO_FILTER, query: "no run is called this" })).toHaveLength(0);
  });
});
