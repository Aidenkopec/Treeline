import { metres } from "@/lib/format";
import { profileGeometry } from "@/lib/profile-path";
import type { ProfileSample } from "@/lib/types";

const WIDTH = 1200;
const HEIGHT = 300;

/**
 * The home page's figure: one real run, drawn from the samples its pitch was
 * measured over.
 *
 * The same `profileGeometry` the run detail card draws with, at masthead scale,
 * so the shape a visitor meets here is the shape they find on the mountain.
 * `preserveAspectRatio="none"` fills the header at any width and shears every
 * glyph with it, which is why the elevations are HTML beside the frame rather
 * than `<text>` inside it.
 */
export function MastheadFigure({
  profile,
  className,
}: {
  profile: ProfileSample[];
  className?: string;
}) {
  const { line, area, topM, bottomM } = profileGeometry(profile, WIDTH, HEIGHT);
  if (!line) return null;

  return (
    <figure className={className}>
      <svg
        aria-hidden="true"
        className="block h-full w-full"
        preserveAspectRatio="none"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        <defs>
          <linearGradient id="masthead-ground" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-surface)" />
            <stop offset="100%" stopColor="var(--color-shadow-deep)" />
          </linearGradient>
        </defs>

        <path d={area} fill="url(#masthead-ground)" />

        {/* Two strokes of one path rather than a band clipped to it: the wide
            soft pass is the light coming off the slope, and it lights the same
            slope wherever it sits instead of by how low it sits in the frame. */}
        <path
          d={line}
          fill="none"
          stroke="var(--color-sun-dim)"
          strokeWidth="9"
          strokeOpacity="0.35"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          className="masthead-trace"
          d={line}
          fill="none"
          pathLength="1"
          stroke="var(--color-sun)"
          strokeDasharray="1 1"
          strokeWidth="2.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* The run descends left to right, so the top of it labels the left end.
          Length is not repeated here: the profile's last sample rounds a metre
          off the baked figure the facts above already print. */}
      <figcaption className="mt-2 flex justify-between">
        <span className="u-data">{metres(topM)}</span>
        <span className="u-data">{metres(bottomM)}</span>
      </figcaption>
    </figure>
  );
}
