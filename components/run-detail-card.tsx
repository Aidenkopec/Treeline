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
 * carry. A panel drawn around it broke that column in half, so there is none:
 * the halo holds the type the way it holds the masthead's.
 *
 * With no panel there is also no visible edge, which decides two things. It
 * must not take the pointer — an invisible rectangle that ate a drag would be
 * un-findable — so only `Clear` opts in. And it must not scroll, for the same
 * reason; `short:` below drops the profile instead.
 *
 * Every value is read off the baked `Run` and formatted; none is computed here
 * (SPEC §5).
 */
export function RunDetailCard({
  onClear,
  run,
  veiled,
}: {
  onClear: () => void;
  run: Run;
  /** Whether the card is standing on terrain rather than on a surface. */
  veiled: boolean;
}) {
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
    <div className="u-halo pointer-events-none relative w-80 pt-1">
      {/* The column's own veil, continuing the masthead's down past the last
          figure. It runs off the left edge of the frame so it has no seam
          there, and the mask dissolves the right one — a rectangle of shadow
          standing on the terrain is the panel this card just stopped being.

          It reaches past the card, which in the drawer is over the run table. */}
      {veiled && (
        <div
          aria-hidden="true"
          className="u-scrim-soft absolute -top-8 -right-16 -bottom-12 -left-8 [mask-image:linear-gradient(to_right,black_72%,transparent)]"
        />
      )}

      {/* Everything the veil is for, lifted over it in one box: an absolute
          sibling paints above static ones whatever the source order says. */}
      <div className="relative">
        <div className="flex items-baseline gap-2">
          <h2 className="u-feature min-w-0 flex-1 truncate text-base text-snow" title={cells.name}>
            {cells.name}
          </h2>
          {/* Bordered, labelled and filled rather than a bare glyph: this is
            the way out of a selection that has also moved the camera, and
            `line` on `rock` is two of the quietest tokens in the palette. With
            nothing drawn around the card, the button has to say on its own
            that it is one. */}
          <button
            className="u-data pointer-events-auto flex shrink-0 cursor-pointer items-center gap-1.5 rounded border border-rock-dim bg-surface px-2.5 py-1.5 text-snow transition-colors hover:border-rock hover:bg-surface-high"
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
    </div>
  );
}
