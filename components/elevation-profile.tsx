import { profileGeometry } from "@/lib/profile-path";
import { metres } from "@/lib/format";
import type { ProfileSample } from "@/lib/types";

const WIDTH = 600;
const HEIGHT = 150;

/**
 * A run's shape, drawn from the samples the pitch was measured over (SPEC §4).
 *
 * Inline SVG rather than a chart library — the shape is a polyline and a fill,
 * and a dependency would weigh more than the drawing (SPEC §5.2). The numbers
 * sit beside it as text, so the chart itself carries nothing a reader needs —
 * which is also why it is drawn short. It lives in a card between a masthead
 * and the sun clock, and height it does not take is height the card has.
 */
export function ElevationProfile({ profile }: { profile: ProfileSample[] }) {
  const { line, area, topM, bottomM } = profileGeometry(profile, WIDTH, HEIGHT);
  if (!line) return null;

  return (
    <figure>
      <svg
        aria-hidden="true"
        className="block h-16 w-full drop-shadow-[0_1px_2px_var(--color-shadow-deep)]"
        preserveAspectRatio="none"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        {/* The fill is the drawing's own ground. Nothing is boxed around this
            any more, and a gold line crossing a sunlit snowfield needs
            something dark under it — so the area carries the scrim a panel
            used to, and the shadow above holds the stroke where it climbs out. */}
        <path d={area} fill="var(--color-shadow-deep)" opacity="0.6" />
        <path
          d={line}
          fill="none"
          stroke="var(--color-sun)"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* The profile descends left to right, so the top of the run labels the
          left end. Length is not repeated here: the panel already prints it,
          and the profile's own last sample rounds a metre off the baked figure. */}
      <figcaption className="mt-2 flex justify-between">
        <span className="u-data">{metres(topM)}</span>
        <span className="u-data">{metres(bottomM)}</span>
      </figcaption>
    </figure>
  );
}
