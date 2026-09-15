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
}: {
  runs: Run[];
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-3xl border-collapse text-sm">
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
                  className={`px-3 py-2.5 first:pl-0 last:pr-0 ${
                    column.numeric ? "text-right" : "text-left"
                  }`}
                  key={column.key}
                  scope="col"
                >
                  <button
                    className={`u-data transition-colors hover:text-snow ${active ? "text-snow" : ""}`}
                    onClick={() => onSort(column.key)}
                    type="button"
                  >
                    {column.label}
                    <span aria-hidden="true">
                      {active ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}
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
            return (
              <tr
                className={`border-b border-line/50 transition-colors ${
                  selected ? "bg-surface-high" : "hover:bg-surface"
                }`}
                key={run.id}
              >
                <th className="py-2 pr-3 text-left font-normal" scope="row">
                  <button
                    aria-current={selected ? "true" : undefined}
                    className="u-feature text-snow"
                    onClick={() => onSelect(run.id)}
                    type="button"
                  >
                    {cells.name}
                  </button>
                </th>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    <DifficultyMark difficulty={run.difficulty} size={9} />
                    <span className="u-data">{difficultyStyle(run.difficulty).label}</span>
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-snow">{cells.pitchAvg}</td>
                <td className="px-3 py-2 text-right text-snow">{cells.pitchMax}</td>
                <td className="px-3 py-2 text-rock">{cells.aspect}</td>
                <td className="px-3 py-2 text-right text-snow">{cells.vertical}</td>
                <td className="py-2 pl-3 text-right text-snow">{cells.length}</td>
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
