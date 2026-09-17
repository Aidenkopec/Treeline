"use client";

import { clockTime, observedAt } from "@/lib/format";
import { type WallClock, instantAt, joinWallClock, splitWallClock, sunTimes } from "@/lib/sun";
import type { Resort } from "@/lib/types";

/**
 * Which slopes are lit, at any hour of any day (SPEC §4). Nothing here attaches a sun
 * state to a run and no slope is called good for having one (SPEC §8). `value` is always
 * a resolved hour, never "now": re-answering that per render would slide under a reader.
 */

/** Finer than the shadow it moves, and coarse enough to drag the whole day. */
const STEP_MINUTES = 10;

const MINUTES_IN_DAY = 24 * 60;

export function SunControl({
  compact,
  onChange,
  pinned,
  resort,
  value,
}: {
  /** On the map, where a handheld has no room for a word column. */
  compact?: boolean;
  /** Null hands the hour back to the mountain's own clock. */
  onChange: (next: WallClock | null) => void;
  /** Whether this hour was chosen, rather than being the one it is there now. */
  pinned: boolean;
  resort: Resort;
  /** Null until the client has a clock to read. */
  value: WallClock | null;
}) {
  const { date, minutes } = value === null ? { date: "", minutes: 0 } : splitWallClock(value);

  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      {/* The legend is the grouping a screen reader answers on. Its width is the
          one the grade and vertical labels keep, so the three stack as a column. */}
      <legend className="sr-only">Sun position at {resort.name}</legend>
      <span
        aria-hidden="true"
        className={`u-data w-16 shrink-0 ${compact ? "handheld:hidden" : ""}`}
      >
        Sun
      </span>

      <label className="sr-only" htmlFor="sun-date">
        Date
      </label>
      <input
        className={`u-feature shrink-0 rounded border border-line bg-surface px-2 py-1.5 text-sm text-snow ${
          compact ? "handheld:px-1.5 handheld:py-1 handheld:text-xs" : ""
        }`}
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
        className="min-w-32 flex-1 accent-sun handheld:min-w-24"
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

      {/* Reserved rather than conditional, for the same reason the readout has
          a fixed width: the first drag is what pins the hour, so a button that
          appeared at that moment would shove the row out from under the thumb. */}
      <span className="w-11 shrink-0 text-right">
        {pinned && (
          <button
            className="u-data cursor-pointer text-rock transition-colors hover:text-snow"
            onClick={() => onChange(null)}
            type="button"
          >
            Now
          </button>
        )}
      </span>
    </fieldset>
  );
}

/**
 * Sunrise and sunset for the day the sun is drawn at. Null is a real answer above the
 * Arctic circle and not one any of these six resorts reaches.
 */
export function SunTimes({ resort, value }: { resort: Resort; value: WallClock | null }) {
  // Keyed off local midday: `getTimes` answers for the UTC solar day its argument is in.
  const day =
    value === null
      ? null
      : sunTimes(resort, instantAt(`${splitWallClock(value).date}T12:00`, resort.timezone));

  return (
    <p className="u-data">
      {day === null || day.sunrise === null || day.sunset === null
        ? "—"
        : `Sunrise ${clockTime(day.sunrise, resort.timezone)} · Sunset ${clockTime(day.sunset, resort.timezone)}`}
    </p>
  );
}
