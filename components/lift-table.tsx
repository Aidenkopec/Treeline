"use client";

import { liftCells } from "@/lib/mountain";
import type { Lift } from "@/lib/types";

/**
 * The lifts, as a table.
 *
 * Unsorted on purpose. `RunTable` sorts because a hundred and sixty-eight rows
 * are unreadable otherwise; ten are not, and the bake already emits them
 * biggest first. Headers here are plain `th` with no buttons and no `aria-sort`
 * — announcing "none" on a table that does not sort tells a screen reader
 * sorting exists and then withholds it.
 *
 * Rows carry no button either. Nothing selects a lift: a cable is drawn where
 * it runs and is legible from the opening framing, so flying the camera to one
 * would be motion without information, and the run selection is the only thing
 * that owns the camera. Hover lights the matching cable and stops there.
 */
export function LiftTable({
  lifts,
  hoveredId,
  onHover,
}: {
  lifts: Lift[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}) {
  if (lifts.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[26rem] border-collapse text-sm">
        <caption className="sr-only">
          Lifts, with vertical rise and length measured from the elevation model along their mapped
          towers, and ride time as the operator publishes it. The run filters above do not apply to
          this table.
        </caption>
        <thead>
          <tr className="border-b border-line">
            <th className="u-data px-2 py-2.5 pl-0 text-left" scope="col">
              Lift
            </th>
            <th className="u-data px-2 py-2.5 text-left" scope="col">
              Type
            </th>
            <th className="u-data px-2 py-2.5 text-right" scope="col">
              Vertical
            </th>
            <th className="u-data px-2 py-2.5 text-right" scope="col">
              Length
            </th>
            <th className="u-data py-2.5 pl-2 text-right" scope="col">
              Ride
            </th>
          </tr>
        </thead>
        <tbody>
          {lifts.map((lift) => {
            const cells = liftCells(lift);
            const hovered = lift.id === hoveredId;
            return (
              <tr
                className={`border-b border-line/50 transition-colors ${
                  hovered ? "bg-surface" : ""
                }`}
                key={lift.id}
                onMouseEnter={() => onHover(lift.id)}
                onMouseLeave={() => onHover(null)}
              >
                <th
                  className="w-full max-w-0 py-2 pr-3 text-left font-normal"
                  scope="row"
                  title={cells.name}
                >
                  <span
                    className={`u-feature block truncate ${
                      lift.name ? "text-snow" : "text-rock-dim"
                    }`}
                  >
                    {cells.name}
                  </span>
                </th>
                <td className="px-2 py-2 text-rock">
                  <span className="whitespace-nowrap">{cells.type}</span>
                </td>
                <td className="px-2 py-2 text-right whitespace-nowrap text-snow">
                  {cells.vertical}
                </td>
                <td className="px-2 py-2 text-right whitespace-nowrap text-snow">{cells.length}</td>
                {/* Without this "7.5 min" breaks across two lines and the row
                    grows taller than its neighbours. */}
                <td className="py-2 pl-2 text-right whitespace-nowrap text-snow">{cells.ride}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
