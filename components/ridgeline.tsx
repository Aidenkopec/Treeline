/**
 * The masthead figure: a ridge in profile, with the treeline marked.
 *
 * This is the project's own chart form — an elevation profile is a real
 * feature (SPEC §4), not an ornament borrowed for the header — and it draws
 * the thing the project is named after: the elevation where trees stop and the
 * alpine begins. Above the line the ridge is drawn in snow, below it in shade.
 *
 * The path is a fixed constant so the server and client render identically.
 */

const RIDGE =
  "M0,140 L60,118 L104,126 L150,88 L182,96 L226,52 L268,74 L310,40 L352,66 L396,30 L442,58 L486,86 L530,72 L574,104 L620,92 L664,118 L710,110 L760,134 L800,128";

/** Where the treeline sits in the viewBox, in the same units as the path. */
const TREELINE_Y = 84;

export function Ridgeline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 800 160" preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        {/* Alpine: the ridge above the treeline. */}
        <clipPath id="above-treeline">
          <rect x="0" y="0" width="800" height={TREELINE_Y} />
        </clipPath>
        {/* Below: the treed slopes. */}
        <clipPath id="below-treeline">
          <rect x="0" y={TREELINE_Y} width="800" height={160 - TREELINE_Y} />
        </clipPath>
      </defs>

      {/* The treeline itself, drawn the weight a map draws a boundary. */}
      <line
        x1="0"
        y1={TREELINE_Y}
        x2="800"
        y2={TREELINE_Y}
        stroke="var(--color-line)"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />

      <g clipPath="url(#below-treeline)">
        <path d={`${RIDGE} L800,160 L0,160 Z`} fill="var(--color-shade-dim)" fillOpacity="0.55" />
        <path
          d={RIDGE}
          fill="none"
          stroke="var(--color-shade)"
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
        />
      </g>

      <g clipPath="url(#above-treeline)">
        <path d={`${RIDGE} L800,160 L0,160 Z`} fill="var(--color-surface)" fillOpacity="0.9" />
        <path
          d={RIDGE}
          fill="none"
          stroke="var(--color-snow)"
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
        />
      </g>
    </svg>
  );
}
