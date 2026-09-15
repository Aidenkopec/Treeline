"use client";

import { PlaceMark } from "@/components/place-mark";
import { placeCells } from "@/lib/mountain";
import type { Place } from "@/lib/types";

/**
 * The named places, as a list.
 *
 * A list rather than a third table: two facts each, and a handful of them.
 * Renders nothing at all where OSM has named nothing, which is an ordinary
 * case rather than a failure to report.
 */
export function PlaceList({
  places,
  hoveredId,
  onHover,
}: {
  places: Place[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}) {
  if (places.length === 0) return null;

  const anySurveyed = places.some((place) => place.ele_m !== null);

  return (
    <ul className="divide-y divide-line/50">
      {places.map((place) => {
        const cells = placeCells(place);
        const hovered = place.id === hoveredId;
        return (
          <li
            className={`flex items-center gap-3 py-2 transition-colors ${
              hovered ? "bg-surface" : ""
            }`}
            key={place.id}
            onMouseEnter={() => onHover(place.id)}
            onMouseLeave={() => onHover(null)}
          >
            <PlaceMark kind={place.kind} size={9} />
            <span className="u-feature min-w-0 flex-1 truncate text-snow">{cells.name}</span>
            <span className="u-data shrink-0">{cells.kind}</span>
            <span className="shrink-0 text-sm text-snow tabular-nums">
              {cells.elevation}
              {/* Marked rather than silently mixed: a summit's height is read
                  off OSM because a 30m model resamples a sharp peak low, and
                  every other height here is this project's own measurement. */}
              {cells.surveyed && (
                <span aria-hidden="true" className="text-rock-dim">
                  *
                </span>
              )}
            </span>
          </li>
        );
      })}
      {anySurveyed && (
        <li className="pt-2 text-xs text-rock-dim">
          * Height as surveyed and published, not measured from the elevation model — a 30m model
          reads a sharp summit low.
        </li>
      )}
    </ul>
  );
}
