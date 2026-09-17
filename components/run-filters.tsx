"use client";

import { useState } from "react";
import { Chip, ChipGroup } from "@/components/chip";
import { ASPECT_LABELS } from "@/lib/aspect";
import { metres } from "@/lib/format";
import { NO_FILTER, type RunFilter, isFiltered } from "@/lib/run-list";
import type { AspectLabel } from "@/lib/types";

/**
 * Narrowing the list, on both views at once (SPEC §9). An empty selection means "no
 * constraint" rather than "nothing", so the panel opens showing the whole mountain. No
 * direction is presented as a better one (SPEC §8). Grade lives on the mountain instead.
 */

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

/** How many of the two foldaway filters are doing something. */
function activeCount(filter: RunFilter): number {
  return (filter.aspects.length > 0 ? 1 : 0) + (filter.minVerticalM > 0 ? 1 : 0);
}

export function RunFilters({
  announce,
  value,
  onChange,
  maxVerticalM,
  shown,
  total,
}: {
  /** Whether this copy of the count is the page's only one. */
  announce: boolean;
  value: RunFilter;
  onChange: (next: RunFilter) => void;
  maxVerticalM: number;
  shown: number;
  total: number;
}) {
  const [open, setOpen] = useState(false);
  const active = activeCount(value);

  const setAspect = (aspect: AspectLabel) =>
    onChange({ ...value, aspects: toggle(value.aspects, aspect) });

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <label className="sr-only" htmlFor="run-search">
            Search run names
          </label>
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-rock-dim"
            fill="none"
            height="14"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 16 16"
            width="14"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5 L14 14" strokeLinecap="round" />
          </svg>
          <input
            autoComplete="off"
            className="u-feature w-full rounded border border-line bg-surface py-2 pr-3 pl-8.5 text-sm text-snow placeholder:text-rock-dim"
            id="run-search"
            onChange={(event) => onChange({ ...value, query: event.target.value })}
            placeholder="Search runs"
            type="search"
            value={value.query}
          />
        </div>

        <button
          aria-controls="run-filter-panel"
          aria-expanded={open}
          className={`u-data flex shrink-0 cursor-pointer items-center gap-1.5 rounded border px-3 py-2 transition-colors ${
            active > 0
              ? "border-sun bg-sun-dim/40 text-snow"
              : "border-line text-rock hover:border-rock-dim hover:text-snow"
          }`}
          onClick={() => setOpen(!open)}
          type="button"
        >
          Filters
          {active > 0 && <span className="tabular-nums">{active}</span>}
          <span aria-hidden="true">{open ? "▴" : "▾"}</span>
        </button>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-2.5" id="run-filter-panel">
          <ChipGroup label="Aspect">
            {ASPECT_LABELS.map((aspect) => (
              <Chip
                active={value.aspects.includes(aspect)}
                key={aspect}
                onClick={() => setAspect(aspect)}
              >
                {aspect}
              </Chip>
            ))}
          </ChipGroup>

          <div className="flex items-center gap-3">
            <label className="u-data w-16 shrink-0" htmlFor="min-vertical">
              Vertical
            </label>
            <input
              className="min-w-0 flex-1 accent-sun"
              id="min-vertical"
              max={maxVerticalM}
              min={0}
              onChange={(event) => onChange({ ...value, minVerticalM: Number(event.target.value) })}
              step={10}
              type="range"
              value={value.minVerticalM}
            />
            {/* Fixed width so the row does not reflow while the slider is dragged. */}
            <span className="u-feature w-12 shrink-0 text-right text-sm text-snow tabular-nums">
              {metres(value.minVerticalM)}
            </span>
          </div>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between gap-3">
        {/* Live only when it is the page's only count: the grade bar carries it otherwise. */}
        <h2 aria-live={announce ? "polite" : undefined} className="u-data">
          {shown === total ? `${total} marked runs` : `${shown} of ${total} shown`}
        </h2>
        {isFiltered(value) && (
          <button
            className="u-data cursor-pointer text-rock transition-colors hover:text-snow"
            onClick={() => onChange(NO_FILTER)}
            type="button"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
