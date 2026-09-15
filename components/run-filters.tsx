"use client";

import { useState } from "react";
import { DifficultyMark } from "@/components/difficulty-mark";
import { ASPECT_LABELS } from "@/lib/aspect";
import { DIFFICULTY_ORDER, difficultyStyle } from "@/lib/difficulty";
import { metres } from "@/lib/format";
import { NO_FILTER, type RunFilter, isFiltered } from "@/lib/run-list";
import type { AspectLabel, Difficulty } from "@/lib/types";

/**
 * Narrowing the list, on both views at once (SPEC §9).
 *
 * An empty selection means "no constraint" rather than "nothing", so the panel
 * opens showing the whole mountain. The labels state what they select and
 * nothing more — no grade or direction is presented as a better one (SPEC §8).
 *
 * Search is always out; grade, aspect and vertical fold away behind a count.
 * Expanded, the three of them are fifteen controls and a slider standing
 * permanently between the reader and the run list, for something most visits
 * never touch.
 */

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

/** How many of the three foldaway filters are doing something. */
function activeCount(filter: RunFilter): number {
  return (
    (filter.difficulties.length > 0 ? 1 : 0) +
    (filter.aspects.length > 0 ? 1 : 0) +
    (filter.minVerticalM > 0 ? 1 : 0)
  );
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`u-data flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors ${
        active
          ? "border-sun bg-sun-dim/40 text-snow"
          : "border-line text-rock hover:border-rock-dim hover:text-snow"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

/**
 * A labelled group of chips.
 *
 * The legend is the grouping a screen reader answers on, and it is `sr-only`
 * because a `<legend>` in a flex row is laid out inconsistently across
 * browsers. The visible label beside it does the same job for the eye.
 */
function ChipGroup({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <fieldset className="flex flex-wrap items-center gap-1.5">
      <legend className="sr-only">{label}</legend>
      <span aria-hidden="true" className="u-data mr-1 w-16 shrink-0">
        {label}
      </span>
      {children}
    </fieldset>
  );
}

export function RunFilters({
  value,
  onChange,
  maxVerticalM,
  shown,
  total,
}: {
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
  const setDifficulty = (difficulty: Difficulty) =>
    onChange({ ...value, difficulties: toggle(value.difficulties, difficulty) });

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
          <ChipGroup label="Grade">
            {DIFFICULTY_ORDER.map((difficulty) => (
              <Chip
                active={value.difficulties.includes(difficulty)}
                key={difficultyStyle(difficulty).label}
                onClick={() => setDifficulty(difficulty)}
              >
                <DifficultyMark difficulty={difficulty} size={9} />
                {difficultyStyle(difficulty).label}
              </Chip>
            ))}
          </ChipGroup>

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
        <h2 aria-live="polite" className="u-data">
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
