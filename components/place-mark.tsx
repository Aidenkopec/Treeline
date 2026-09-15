import { placeStyle } from "@/lib/mountain";
import type { PlaceKind } from "@/lib/types";

/**
 * The marker for a named place.
 *
 * The twin of `DifficultyMark`, and deliberately drawn from a shape vocabulary
 * that one does not use: circles, squares and diamonds carry run difficulty,
 * and a lodge that looked like a grade would be worse than no marker at all.
 * The outline comes from `PLACE_STYLES`, which is also what the terrain sprite
 * is drawn from, so the map and the list cannot disagree.
 */
export function PlaceMark({ kind, size = 10 }: { kind: PlaceKind; size?: number }) {
  const style = placeStyle(kind);

  return (
    <span
      className="inline-flex shrink-0 items-center align-middle text-rock"
      role="img"
      aria-label={style.label}
    >
      {/* `currentColor` so the mark takes the ink of whatever is describing it —
          dim in a list row, bright on a label being pointed at — rather than
          carrying a colour of its own to keep in step. */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 10 10"
        aria-hidden="true"
        fill={style.filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={style.filled ? 0.9 : 1.1}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      >
        <path d={style.path} />
      </svg>
    </span>
  );
}
