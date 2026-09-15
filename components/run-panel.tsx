import { DifficultyMark } from "@/components/difficulty-mark";
import { ElevationProfile } from "@/components/elevation-profile";
import { difficultyStyle } from "@/lib/difficulty";
import { runCells } from "@/lib/run-list";
import type { Run } from "@/lib/types";

/**
 * The selected run's numbers.
 *
 * Every value is read off the baked `Run` and formatted; none is computed here
 * (SPEC §5). Pitch prints whole degrees because that is what a 30m elevation
 * model supports — see `lib/format.ts`.
 *
 * It sits at the head of the list rather than on the canvas. Floating it over
 * the terrain put a card across the mountain the whole time a run was selected,
 * which is the one thing on this page that should stay uncovered.
 */
export function RunPanel({ run, onClear }: { run: Run | null; onClear: () => void }) {
  if (!run) {
    return (
      <p className="mt-2.5 text-sm text-rock-dim">
        Select a run, here or on the mountain, to see its measurements.
      </p>
    );
  }

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
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex items-baseline gap-3">
        <h2 className="u-feature min-w-0 flex-1 truncate text-lg text-snow">{cells.name}</h2>
        <span className="flex shrink-0 items-center gap-1.5">
          <DifficultyMark difficulty={run.difficulty} size={9} />
          <span className="u-data">{style.label}</span>
        </span>
        {/* Bordered and labelled rather than a bare glyph in the dimmest ink
            the palette has. This is the way out of a selection that has also
            moved the camera, so it has to be findable at the far right of a
            40rem pane without being hunted for. */}
        <button
          className="u-data flex shrink-0 cursor-pointer items-center gap-1.5 rounded border border-line px-2 py-1 text-rock transition-colors hover:border-rock-dim hover:text-snow"
          onClick={onClear}
          type="button"
        >
          Clear
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      <div className="mt-3 flex items-start gap-6">
        <dl className="grid flex-1 grid-cols-3 gap-x-5 gap-y-3">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt className="u-data">{label}</dt>
              <dd className="u-feature text-sm text-snow tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        {/* Boxed rather than run to the full width of the list: the profile is
            drawn with preserveAspectRatio="none", so stretching it across the
            pane flattens a 367m drop into a ramp. */}
        <div className="w-56 shrink-0">
          <ElevationProfile profile={run.profile} />
        </div>
      </div>
    </div>
  );
}
