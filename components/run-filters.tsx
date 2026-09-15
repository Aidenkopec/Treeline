"use client";

import { DifficultyMark } from "@/components/difficulty-mark";
import { ASPECT_LABELS } from "@/lib/aspect";
import { DIFFICULTY_ORDER, difficultyStyle } from "@/lib/difficulty";
import { metres } from "@/lib/format";
import type { RunFilter } from "@/lib/run-list";
import type { AspectLabel, Difficulty } from "@/lib/types";

/**
 * Narrowing the list, on both views at once (SPEC §9).
 *
 * An empty selection means "no constraint" rather than "nothing", so the panel
 * opens showing the whole mountain. The labels state what they select and
 * nothing more — no grade or direction is presented as a better one (SPEC §8).
 */

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
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
      className={`u-data flex items-center gap-2 rounded-full border px-3 py-1.5 transition-colors ${
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

export function RunFilters({
  value,
  onChange,
  maxVerticalM,
}: {
  value: RunFilter;
  onChange: (next: RunFilter) => void;
  maxVerticalM: number;
}) {
  const setAspect = (aspect: AspectLabel) =>
    onChange({ ...value, aspects: toggle(value.aspects, aspect) });
  const setDifficulty = (difficulty: Difficulty) =>
    onChange({ ...value, difficulties: toggle(value.difficulties, difficulty) });

  return (
    <div className="w-72 max-w-full rounded border border-line bg-surface/90 p-5 shadow-panel backdrop-blur-sm">
      <fieldset>
        <legend className="u-data">Difficulty</legend>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
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
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="u-data">Aspect</legend>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {ASPECT_LABELS.map((aspect) => (
            <Chip
              active={value.aspects.includes(aspect)}
              key={aspect}
              onClick={() => setAspect(aspect)}
            >
              {aspect}
            </Chip>
          ))}
        </div>
      </fieldset>

      <div className="mt-5">
        <label className="u-data flex justify-between" htmlFor="min-vertical">
          <span>Minimum vertical</span>
          <span className="text-snow">{metres(value.minVerticalM)}</span>
        </label>
        <input
          className="mt-2.5 w-full accent-sun"
          id="min-vertical"
          max={maxVerticalM}
          min={0}
          onChange={(event) => onChange({ ...value, minVerticalM: Number(event.target.value) })}
          step={10}
          type="range"
          value={value.minVerticalM}
        />
      </div>
    </div>
  );
}
