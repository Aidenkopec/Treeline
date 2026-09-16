"use client";

import { clockTime, observedAt } from "@/lib/format";
import { type WallClock, instantAt, joinWallClock, splitWallClock, sunTimes } from "@/lib/sun";
import type { Resort } from "@/lib/types";

/**
 * Which slopes are lit, at any hour of any day (SPEC §4).
 *
 * The mountain is the answer — nothing here attaches a sun state to a run, and
 * no slope is called good or bad for having one (SPEC §8). What it does print
 * is sunrise and sunset, which are facts about the place rather than about the
 * render, so the readout still says something without a GPU (SPEC §9).
 *
 * `value` is always a resolved hour, never "now": which hour "now" means is the
 * page's question, answered once by `openingWallClock`, and a control that
 * re-answered it on every render would slide out from under a reader.
 *
 * It sits on the mountain because the mountain is its readout. Dragging the
 * hour on one side of the window while the shadows move on the other is a
 * control you cannot watch yourself using.
 */

/** Finer than the shadow it moves, and coarse enough to drag the whole day. */
const STEP_MINUTES = 10;

const MINUTES_IN_DAY = 24 * 60;

export function SunControl({
  onChange,
  pinned,
  resort,
  value,
}: {
  /** Null hands the hour back to the mountain's own clock. */
  onChange: (next: WallClock | null) => void;
  /** Whether this hour was chosen, rather than being the one it is there now. */
  pinned: boolean;
  resort: Resort;
  /** Null until the client has a clock to read. */
  value: WallClock | null;
}) {
  const { date, minutes } = value === null ? { date: "", minutes: 0 } : splitWallClock(value);
  // Keyed off local midday rather than off `value`: `getTimes` answers for the
  // UTC solar day its argument falls in, and at 11pm in Alberta that is already
  // tomorrow's sunrise.
  const day = value === null ? null : sunTimes(resort, instantAt(`${date}T12:00`, resort.timezone));

  return (
    <div>
      <fieldset className="flex flex-wrap items-center gap-2">
        {/* The legend is the grouping a screen reader answers on; the visible
            label beside it does the same job for the eye. */}
        <legend className="sr-only">Sun position at {resort.name}</legend>
        <span aria-hidden="true" className="u-data w-16 shrink-0">
          Sun
        </span>

        <label className="sr-only" htmlFor="sun-date">
          Date
        </label>
        <input
          className="u-feature shrink-0 rounded border border-line bg-surface px-2 py-1.5 text-sm text-snow"
          disabled={value === null}
          id="sun-date"
          onChange={(event) =>
            event.target.value && onChange(joinWallClock(event.target.value, minutes))
          }
          type="date"
          value={date}
        />

        <label className="sr-only" htmlFor="sun-time">
          Time of day
        </label>
        <input
          className="min-w-32 flex-1 accent-sun"
          disabled={value === null}
          id="sun-time"
          max={MINUTES_IN_DAY - STEP_MINUTES}
          min={0}
          onChange={(event) => onChange(joinWallClock(date, Number(event.target.value)))}
          step={STEP_MINUTES}
          type="range"
          value={minutes}
        />

        {/* Fixed width so the row does not reflow while the slider is dragged. */}
        <span className="u-feature w-24 shrink-0 text-right text-sm text-snow tabular-nums">
          {value === null
            ? "—"
            : observedAt(instantAt(value, resort.timezone).toISOString(), resort.timezone)}
        </span>
      </fieldset>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        {/* One zone, said once. Null is a real answer above the Arctic circle
            and not one any of these six reaches. */}
        <p className="u-data">
          {day === null || day.sunrise === null || day.sunset === null
            ? "—"
            : `Sunrise ${clockTime(day.sunrise, resort.timezone)} · Sunset ${clockTime(day.sunset, resort.timezone)}`}
        </p>
        {pinned && (
          <button
            className="u-data cursor-pointer text-rock transition-colors hover:text-snow"
            onClick={() => onChange(null)}
            type="button"
          >
            Now
          </button>
        )}
      </div>
    </div>
  );
}
