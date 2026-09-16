"use client";

import { DifficultyMark } from "@/components/difficulty-mark";
import { ElevationProfile } from "@/components/elevation-profile";
import { difficultyStyle } from "@/lib/difficulty";
import { runCells } from "@/lib/run-list";
import type { Run } from "@/lib/types";

/**
 * The selected run's numbers, on the mountain that is drawing it.
 *
 * This reverses phase 3's "nothing on the terrain but the header", which moved
 * the panel off the canvas because a card sat across the west face the whole
 * time a run was picked. What makes it answerable now is the camera: the scene
 * is told what the chrome covers and composes the massif into what is left, so
 * the card no longer costs the mountain the ground it stands on.
 *
 * It sits under the resort's own name, continuing one column from the range to
 * the feature to the readout — which is the hierarchy the type widths already
 * carry. Every value is read off the baked `Run` and formatted; none is
 * computed here (SPEC §5).
 */
export function RunDetailCard({ onClear, run }: { onClear: () => void; run: Run }) {
  const cells = runCells(run);
  const style = difficultyStyle(run.difficulty);
  const stats = [
    ["Avg pitch", cells.pitchAvg],
    ["Steepest", cells.pitchMax],
    ["Aspect", cells.aspect],
    ["Vertical", cells.vertical],
    ["Length", cells.length],
  ] as const;

  return (
    <div className="u-panel max-h-[min(38vh,22rem)] w-80 overflow-y-auto px-4 py-3">
      <div className="flex items-baseline gap-2">
        <h2 className="u-feature min-w-0 flex-1 truncate text-base text-snow" title={cells.name}>
          {cells.name}
        </h2>
        {/* Bordered and labelled rather than a bare glyph: this is the way out
            of a selection that has also moved the camera. */}
        <button
          className="u-data flex shrink-0 cursor-pointer items-center gap-1.5 rounded border border-line px-2 py-1 text-rock transition-colors hover:border-rock-dim hover:text-snow"
          onClick={onClear}
          type="button"
        >
          Clear
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      <p className="mt-1.5 flex items-center gap-1.5">
        <DifficultyMark difficulty={run.difficulty} size={9} />
        <span className="u-data">{style.label}</span>
      </p>

      {/* Three across, so five figures are two rows rather than three. The
          masthead above and the sun clock below leave this card less height
          than a pane had, and the row it saves is the elevation profile's. */}
      <dl className="mt-3 grid grid-cols-3 gap-x-4 gap-y-2.5">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt className="u-data">{label}</dt>
            <dd className="u-feature text-sm text-snow tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {/* The tall part, and the first thing to go when the window is short —
          the five figures above are the measurements, the shape is context. */}
      <div className="mt-4 short:hidden">
        <ElevationProfile profile={run.profile} />
      </div>
    </div>
  );
}
