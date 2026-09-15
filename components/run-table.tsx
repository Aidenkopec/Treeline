"use client";

import { DifficultyMark } from "@/components/difficulty-mark";
import { difficultyStyle } from "@/lib/difficulty";
import { type SortDirection, type SortKey, runCells } from "@/lib/run-list";
import type { Run } from "@/lib/types";

/**
 * The same runs as real HTML.
 *
 * Not a fallback and not an `aria-label`: the canvas is `aria-hidden` and needs
 * a GPU, so without one this table is the site (SPEC §9). It renders every
 * filtered row with the document, so the numbers are readable before any
 * JavaScript runs — sorting is the only part that needs it.
 */

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "name", label: "Run", numeric: false },
  { key: "difficulty", label: "Grade", numeric: false },
  { key: "pitch_avg_deg", label: "Avg pitch", numeric: true },
  { key: "pitch_max_deg", label: "Steepest", numeric: true },
  { key: "aspect", label: "Aspect", numeric: false },
  { key: "vertical_m", label: "Vertical", numeric: true },
  { key: "length_m", label: "Length", numeric: true },
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
      {/* Seven columns whose width is set by their headers, not their values,
          come to 33rem; the run name takes whatever is left. Asserting more
          than that scrolls the table sideways inside the list pane for no
          reason, which is what min-w-3xl was doing. */}
      <table className="w-full min-w-[33rem] border-collapse text-sm">
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
                  } ${active ? "border-b-2 border-sun" : ""}`}
                  key={column.key}
                  scope="col"
                >
                  {/* Every header carries a glyph, not just the sorted one:
                      with six of seven looking like labels, nobody found out
                      the columns sort at all. */}
                  <button
                    className={`u-data inline-flex cursor-pointer items-center gap-1 whitespace-nowrap transition-colors group-hover:text-snow ${
                      active ? "text-snow" : ""
                    }`}
                    onClick={() => onSort(column.key)}
                    type="button"
                  >
                    {column.label}
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
              // Hover is tracked rather than left to CSS because it lights the
              // run on the mountain too, and the mountain lights the row back.
              <tr
                className={`border-b border-line/50 transition-colors ${
                  selected ? "bg-surface-high" : hovered ? "bg-surface" : ""
                }`}
                key={run.id}
                onMouseEnter={() => onHover(run.id)}
                onMouseLeave={() => onHover(null)}
              >
                <th className="w-full max-w-0 py-2 pr-3 text-left font-normal" scope="row">
                  {/* Clipped rather than wrapped. The name column takes what the
                      other six leave, which on a narrow list pane is not much,
                      and a handful of two-line rows makes 168 of them harder to
                      run an eye down than a few tails do. The whole name is
                      still in the cell, and in the panel once it is picked. */}
                  <button
                    aria-current={selected ? "true" : undefined}
                    className="u-feature block w-full cursor-pointer truncate text-left text-snow"
                    title={cells.name}
                    onBlur={() => onHover(null)}
                    onClick={() => onSelect(run.id)}
                    onFocus={() => onHover(run.id)}
                    type="button"
                  >
                    {cells.name}
                  </button>
                </th>
                <td className="px-2 py-2">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <DifficultyMark difficulty={run.difficulty} size={9} />
                    <span className="u-data">{difficultyStyle(run.difficulty).label}</span>
                  </span>
                </td>
                <td className="px-2 py-2 text-right text-snow">{cells.pitchAvg}</td>
                <td className="px-2 py-2 text-right text-snow">{cells.pitchMax}</td>
                <td className="px-2 py-2 text-rock">{cells.aspect}</td>
                <td className="px-2 py-2 text-right text-snow">{cells.vertical}</td>
                <td className="py-2 pl-2 text-right text-snow">{cells.length}</td>
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
