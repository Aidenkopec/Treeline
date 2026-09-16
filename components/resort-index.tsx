import Link from "next/link";
import { metres } from "@/lib/format";
import type { ResortFeature, Silhouette } from "@/lib/masthead";

const FRAME_W = 220;
const FRAME_H = 56;

/**
 * The six mountains, and the shape of a run at each.
 *
 * A table because the rows are compared down their columns, the same reason
 * `components/run-table.tsx` is one. The profiles are drawn to a single scale
 * (`silhouettes`), so the column reads as six runs beside each other rather
 * than six cells each normalised to itself.
 *
 * No run name appears here. The drawing is `aria-hidden` and the cell's
 * readable content is the vertical beside it.
 */
export function ResortIndex({
  features,
  silhouettes,
}: {
  features: ResortFeature[];
  silhouettes: Silhouette[];
}) {
  const shapes = new Map(silhouettes.map((s) => [s.slug, s]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Every resort, with the number of marked runs and lifts measured at each, and the date it
          was measured. Each profile draws one named run, all six at one scale.
        </caption>
        <thead>
          <tr className="border-b border-line text-left">
            <th className="u-data py-2 pr-2 font-medium sm:pr-4">Mountain</th>
            <th className="u-data hidden py-2 pr-2 font-medium sm:table-cell sm:pr-4">Country</th>
            <th className="u-data py-2 pr-2 font-medium sm:pr-4">Profile</th>
            <th className="u-data py-2 pr-2 text-right font-medium sm:pr-4">Runs</th>
            <th className="u-data hidden py-2 pr-2 text-right font-medium sm:table-cell sm:pr-4">
              Lifts
            </th>
            <th className="u-data hidden py-2 pr-2 text-right font-medium sm:pr-4 lg:table-cell">
              Elevation
            </th>
            <th className="u-data py-2 text-right font-medium">Measured</th>
          </tr>
        </thead>
        <tbody>
          {features.map((feature) => {
            const { planned, resort, run, runCount, liftCount } = feature;
            const shape = shapes.get(planned.slug);

            return (
              <tr className="border-b border-line align-middle" key={planned.slug}>
                <td className="py-3 pr-2 sm:pr-4">
                  {resort ? (
                    <Link
                      className="u-feature text-base text-snow underline decoration-line underline-offset-4 transition-colors hover:decoration-sun"
                      href={`/resorts/${planned.slug}`}
                    >
                      {planned.name}
                    </Link>
                  ) : (
                    <span className="u-feature text-base text-snow">{planned.name}</span>
                  )}
                  {/* The column a phone loses, kept as a line under the name
                      rather than dropped outright. */}
                  <span className="u-data block sm:hidden">{planned.country}</span>
                </td>

                <td className="u-data hidden py-3 pr-2 sm:table-cell sm:pr-4">{planned.country}</td>

                <td className="py-3 pr-2 sm:pr-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    {shape && (
                      <svg
                        aria-hidden="true"
                        className="h-7 w-10 shrink-0 sm:w-24 lg:w-32"
                        preserveAspectRatio="xMinYMin meet"
                        viewBox={`0 0 ${FRAME_W} ${FRAME_H}`}
                      >
                        <path
                          d={shape.geometry.line}
                          fill="none"
                          stroke="var(--color-shade)"
                          strokeWidth="1.5"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    )}
                    <span className="u-data tabular-nums">
                      {run ? metres(run.vertical_m) : "—"}
                    </span>
                  </div>
                </td>

                <td className="py-3 pr-2 text-right text-snow tabular-nums sm:pr-4">
                  {resort ? runCount : "—"}
                </td>
                {/* The second column a phone loses. `Measured` never goes: SPEC
                    §8 wants the age of the data visible, and a phone is where a
                    snapshot is most likely to be read as a live feed. */}
                <td className="hidden py-3 pr-2 text-right text-snow tabular-nums sm:table-cell sm:pr-4">
                  {resort ? liftCount : "—"}
                </td>
                <td className="u-data hidden py-3 pr-2 text-right tabular-nums sm:pr-4 lg:table-cell">
                  {resort
                    ? `${metres(resort.elevation_min_m)}–${metres(resort.elevation_max_m)}`
                    : "—"}
                </td>
                <td className="u-data py-3 text-right tabular-nums">
                  {resort ? resort.baked_at : "not measured"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
