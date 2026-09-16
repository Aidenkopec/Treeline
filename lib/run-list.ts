import { ASPECT_LABELS } from "./aspect";
import { DIFFICULTY_ORDER } from "./difficulty";
import { degrees, kilometres, metres } from "./format";
import type { AspectLabel, Difficulty, Run } from "./types";

/**
 * Choosing and ordering runs, and turning one into table cells.
 *
 * Kept out of the components so it can be tested: `vitest` runs in node with no
 * DOM, and a filter that silently drops a grade or a sort that reorders equal
 * rows is exactly the kind of mistake a screenshot does not catch. Nothing here
 * computes a statistic — every number is read off the baked `Run` (SPEC §5).
 */

export interface RunFilter {
  /** Empty means no constraint, not "no aspects". */
  aspects: AspectLabel[];
  /** Empty means no constraint; `[null]` selects only the untagged ways. */
  difficulties: Difficulty[];
  minVerticalM: number;
  /** Blank means no constraint, the same way an empty list does. */
  query: string;
}

export const NO_FILTER: RunFilter = {
  aspects: [],
  difficulties: [],
  minVerticalM: 0,
  query: "",
};

/**
 * Casefolded and stripped of accents, so a query typed on a plain keyboard
 * reaches a name that was not. Niseko is on the list of resorts to bake and its
 * runs romanise with macrons (SPEC §4).
 */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function matchesFilter(run: Run, filter: RunFilter): boolean {
  if (filter.aspects.length > 0 && !filter.aspects.includes(run.aspect_label)) return false;
  if (filter.difficulties.length > 0 && !filter.difficulties.includes(run.difficulty)) return false;
  if (run.vertical_m < filter.minVerticalM) return false;

  const query = normalise(filter.query.trim());
  // Matched against the string the table prints, so searching "unnamed" finds
  // the ways that have no name rather than nothing at all.
  return query === "" || normalise(run.name ?? UNNAMED_RUN).includes(query);
}

export function filterRuns(runs: Run[], filter: RunFilter): Run[] {
  return runs.filter((run) => matchesFilter(run, filter));
}

/** Whether the filter constrains anything, which is what "clear" has to undo. */
export function isFiltered(filter: RunFilter): boolean {
  return (
    filter.aspects.length > 0 ||
    filter.difficulties.length > 0 ||
    filter.minVerticalM > 0 ||
    filter.query.trim() !== ""
  );
}

/** Empty means every grade, so a chip row reads its lit state off this. */
export function shownDifficulties(filter: RunFilter): Difficulty[] {
  return filter.difficulties.length === 0 ? DIFFICULTY_ORDER : filter.difficulties;
}

/**
 * Toggles against `shownDifficulties`, so the first click on an unfiltered list
 * takes a grade away rather than selecting one. All or none normalises back to
 * `[]`, keeping one spelling of "no constraint".
 */
export function toggleDifficulty(filter: RunFilter, difficulty: Difficulty): RunFilter {
  const shown = new Set(shownDifficulties(filter));
  const next = DIFFICULTY_ORDER.filter((held) => shown.has(held) !== (held === difficulty));

  return {
    ...filter,
    difficulties: next.length === 0 || next.length === DIFFICULTY_ORDER.length ? [] : next,
  };
}

export type SortKey =
  "name" | "difficulty" | "vertical_m" | "length_m" | "pitch_avg_deg" | "pitch_max_deg" | "aspect";

export type SortDirection = "asc" | "desc";

/**
 * Where a run sits on a given axis. `null` means the run has no place on it —
 * an unnamed way and an untagged grade are absences, not values, and they sort
 * to the bottom whichever way the column points.
 */
function rank(run: Run, key: SortKey): number | string | null {
  switch (key) {
    case "name":
      return run.name;
    case "difficulty": {
      const index = DIFFICULTY_ORDER.indexOf(run.difficulty);
      return run.difficulty === null ? null : index;
    }
    // Not aspect_deg: bucketed on its label, 350° is north and belongs at the
    // top of the compass, not after west.
    case "aspect":
      return ASPECT_LABELS.indexOf(run.aspect_label);
    default:
      return run[key];
  }
}

export function sortRuns(runs: Run[], key: SortKey, direction: SortDirection): Run[] {
  const sign = direction === "asc" ? 1 : -1;

  return [...runs].sort((a, b) => {
    const left = rank(a, key);
    const right = rank(b, key);

    if (left === null || right === null) {
      if (left === right) return a.id.localeCompare(b.id);
      return left === null ? 1 : -1;
    }

    const order =
      typeof left === "string" && typeof right === "string"
        ? left.localeCompare(right)
        : Number(left) - Number(right);

    // Tie-break on id so re-sorting a column never reshuffles equal rows.
    return order === 0 ? a.id.localeCompare(b.id) : sign * order;
  });
}

export interface RunCells {
  name: string;
  vertical: string;
  length: string;
  pitchAvg: string;
  pitchMax: string;
  aspect: string;
}

/** An unnamed OSM way, said plainly rather than left blank. */
export const UNNAMED_RUN = "Unnamed run";

/**
 * A run as the strings the table prints.
 *
 * Here rather than in the component so the phase gate — "stats in UI match
 * runs.json" — is a test. Pitch loses its decimal on the way through
 * `degrees()`, which is `lib/format.ts`'s standing judgement about what 30m
 * data supports, not a rounding accident.
 */
export function runCells(run: Run): RunCells {
  return {
    name: run.name ?? UNNAMED_RUN,
    vertical: metres(run.vertical_m),
    length: kilometres(run.length_m),
    pitchAvg: degrees(run.pitch_avg_deg),
    pitchMax: degrees(run.pitch_max_deg),
    aspect: `${run.aspect_label} ${degrees(run.aspect_deg)}`,
  };
}
