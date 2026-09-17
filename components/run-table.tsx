"use client";

import { DifficultyMark } from "@/components/difficulty-mark";
import { difficultyStyle } from "@/lib/difficulty";
import { type SortDirection, type SortKey, runCells } from "@/lib/run-list";
import type { Run } from "@/lib/types";

/**
 * The same runs as real HTML. Not a fallback: the canvas is `aria-hidden` and needs a GPU,
 * so without one this table is the site (SPEC §9). Every filtered row renders with the
 * document, so the numbers read before any JavaScript runs; only sorting needs it.
 */

// Seven columns need 33rem of header; a handheld has half, so three fold under the name.
const COLUMNS: { key: SortKey; label: string; numeric: boolean; folds: boolean; tight?: true }[] = [
  { key: "name", label: "Run", numeric: false, folds: false },
  { key: "difficulty", label: "Grade", numeric: false, folds: false, tight: true },
  { key: "pitch_avg_deg", label: "Avg pitch", numeric: true, folds: false },
  { key: "pitch_max_deg", label: "Steepest", numeric: true, folds: true },
  { key: "aspect", label: "Aspect", numeric: false, folds: true },
  { key: "vertical_m", label: "Vertical", numeric: true, folds: false },
  { key: "length_m", label: "Length", numeric: true, folds: true },
];

export function RunTable({
  runs,
  sortKey,
  sortDirection,
  onSort,
  selectedId,
  onSelect,
  hoveredId,
  onHover,
}: {
  runs: Run[];
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}) {
  return (
    <div className="overflow-x-auto">
      {/* Seven columns sized by their headers rather than their values come to
          33rem; the run name takes what is left. Asserting more scrolls the pane. */}
      <table className="w-full min-w-[33rem] border-collapse text-sm handheld:min-w-0">
        <caption className="sr-only">
          Marked runs with pitch, aspect, vertical and length measured from the elevation model.
        </caption>
        <thead>
          <tr className="border-b border-line">
            {COLUMNS.map((column) => {
              const active = column.key === sortKey;
              return (
                <th
                  aria-sort={
                    active ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
                  }
                  className={`group px-2 py-2.5 first:pl-0 last:pr-0 ${
                    column.numeric ? "text-right" : "text-left"
                  } ${active ? "border-b-2 border-sun" : ""} ${
                    column.folds ? "handheld:hidden" : ""
                  }`}
                  key={column.key}
                  scope="col"
                >
                  {/* Every header carries a glyph, not just the sorted one:
                      with six of seven looking like labels, nobody found out
                      the columns sort at all. */}
                  <button
                    className={`u-data inline-flex cursor-pointer items-center gap-1 whitespace-nowrap transition-colors group-hover:text-snow ${
                      active ? "text-snow" : ""
                    } ${column.tight ? "handheld:px-2 handheld:py-1" : ""}`}
                    onClick={() => onSort(column.key)}
                    type="button"
                  >
                    {/* A handheld's grade cell is the mark alone, a few pixels
                        wide. Left visible, the word would set the column. */}
                    <span className={column.tight ? "handheld:sr-only" : ""}>{column.label}</span>
                    <span aria-hidden="true" className={active ? "text-sun" : "text-rock-dim"}>
                      {active ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {runs.map((run) => {
            const cells = runCells(run);
            const selected = run.id === selectedId;
            const hovered = run.id === hoveredId;
            return (
              // Tracked rather than left to CSS: it lights the run on the mountain too.
              <tr
                className={`border-b border-line/50 transition-colors ${
                  selected ? "bg-surface-high" : hovered ? "bg-surface" : ""
                }`}
                data-run={run.id}
                key={run.id}
                onMouseEnter={() => onHover(run.id)}
                onMouseLeave={() => onHover(null)}
              >
                <th className="w-full max-w-0 py-2 pr-3 text-left font-normal" scope="row">
                  {/* Clipped rather than wrapped: the name column takes what the other
                      six leave, and two-line rows make 168 of them harder to run an
                      eye down. The whole name is still in the cell either way. */}
                  <button
                    aria-current={selected ? "true" : undefined}
                    className="u-feature block w-full cursor-pointer truncate text-left text-snow handheld:overflow-visible"
                    title={cells.name}
                    onBlur={() => onHover(null)}
                    onClick={() => onSelect(run.id)}
                    onFocus={() => onHover(run.id)}
                    type="button"
                  >
                    <span className="block truncate">{cells.name}</span>

                    {/* The three columns a handheld folds, kept as a line under
                        the name and inside the button, which is what makes the
                        whole two-line block a thumb's target. */}
                    <span className="u-data mt-0.5 hidden truncate handheld:block">
                      <span className="sr-only">Steepest </span>
                      {cells.pitchMax} · <span className="sr-only">Aspect </span>
                      {cells.aspect} · <span className="sr-only">Length </span>
                      {cells.length}
                    </span>
                  </button>
                </th>
                <td className="px-2 py-2 handheld:pr-0 handheld:pl-1">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <DifficultyMark difficulty={run.difficulty} size={9} />
                    {/* The mark is the shape that carries grade on the map
                        (SPEC §9) and names itself, so the word folds away
                        rather than to `sr-only`, which would say it twice. */}
                    <span className="u-data handheld:hidden">
                      {difficultyStyle(run.difficulty).label}
                    </span>
                  </span>
                </td>
                <td className="px-2 py-2 text-right text-snow">{cells.pitchAvg}</td>
                <td className="px-2 py-2 text-right text-snow handheld:hidden">{cells.pitchMax}</td>
                <td className="px-2 py-2 text-rock handheld:hidden">{cells.aspect}</td>
                <td className="px-2 py-2 text-right text-snow">{cells.vertical}</td>
                <td className="py-2 pl-2 text-right text-snow handheld:hidden">{cells.length}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {runs.length === 0 && (
        <p className="py-8 text-center text-sm text-rock">No runs match these filters.</p>
      )}
    </div>
  );
}
