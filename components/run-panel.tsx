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
 */
export function RunPanel({ run }: { run: Run | null }) {
  if (!run) {
    return (
      <div className="w-72 max-w-full rounded border border-line bg-surface/90 p-5 shadow-panel backdrop-blur-sm">
        <p className="text-sm text-rock">
          Choose a run from the table below, or on the mountain, to see its measurements.
        </p>
      </div>
    );
  }

  const cells = runCells(run);
  const style = difficultyStyle(run.difficulty);
  const stats = [
    ["Average pitch", cells.pitchAvg],
    ["Steepest pitch", cells.pitchMax],
    ["Aspect", cells.aspect],
    ["Vertical", cells.vertical],
    ["Length", cells.length],
  ] as const;

  return (
    <div className="w-72 max-w-full rounded border border-line bg-surface/90 p-5 shadow-panel backdrop-blur-sm">
      <h2 className="u-feature text-lg text-snow">{cells.name}</h2>

      <p className="mt-1.5 flex items-center gap-2">
        <DifficultyMark difficulty={run.difficulty} />
        <span className="u-data">{style.label}</span>
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt className="u-data">{label}</dt>
            <dd className="u-feature text-sm text-snow tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <ElevationProfile profile={run.profile} />
    </div>
  );
}
