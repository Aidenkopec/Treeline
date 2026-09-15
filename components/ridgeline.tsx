/**
 * The masthead figure: one mountain under a low sun, with the treeline marked,
 * a lift running up its face and a run coming back down it.
 *
 * This is the project's own chart form — an elevation profile is a real
 * feature (SPEC §4), not an ornament borrowed for the header — and it draws
 * the thing the project is named after: the elevation where trees stop and the
 * alpine begins.
 *
 * Two things are read off it at once, which is the Imhof convention the whole
 * palette is built on (SPEC §4's sun/shade feature): *value* carries the
 * treeline, so the alpine is lighter than the treed slopes below it, and *hue*
 * carries the sun, so the face warms toward the light and the back side falls
 * into cool shadow.
 *
 * It is one massif rather than a range because a ski area is one hill. The lift
 * is a straight chord because a lift is a cable strung between towers, which
 * also keeps it clear of the run following the ground beneath it.
 *
 * The geometry is a fixed constant so the server and client render identically.
 */

/** Profile vertices, in viewBox units: a base area, one long face, a back side. */
const PROFILE = [
  [0, 272],
  [110, 270],
  [230, 268],
  [340, 266],
  [420, 262],
  [500, 250],
  [580, 242],
  [660, 228],
  [740, 220],
  [805, 202],
  [870, 182],
  [935, 158],
  [1000, 132],
  [1060, 104],
  [1115, 74],
  [1155, 50],
  [1190, 30],
  [1290, 74],
  [1380, 120],
  [1470, 156],
  [1570, 182],
  [1680, 198],
  [1800, 208],
] as const satisfies readonly (readonly [number, number])[];

/**
 * Further ridges, hazed back. A section is drawn with the country behind it,
 * and each one sits closer to the sky's own tone than the one in front — which
 * is what makes distance read as distance rather than as a smudge.
 */
const BACKDROPS = [
  {
    opacity: 0.16,
    points: [
      [0, 196],
      [220, 170],
      [430, 188],
      [640, 156],
      [860, 180],
      [1080, 150],
      [1300, 172],
      [1520, 144],
      [1740, 168],
      [1800, 172],
    ],
  },
  {
    opacity: 0.24,
    points: [
      [0, 222],
      [200, 198],
      [400, 216],
      [600, 186],
      [820, 210],
      [1040, 182],
      [1260, 204],
      [1480, 178],
      [1700, 200],
      [1800, 208],
    ],
  },
  {
    opacity: 0.32,
    points: [
      [0, 232],
      [150, 208],
      [300, 224],
      [450, 188],
      [600, 206],
      [750, 170],
      [900, 190],
      [1050, 158],
      [1200, 180],
      [1350, 148],
      [1500, 174],
      [1650, 192],
      [1800, 206],
    ],
  },
] as const satisfies readonly { opacity: number; points: readonly (readonly [number, number])[] }[];

/**
 * The marked run the readout describes, and the rest of the hill around it.
 *
 * All of them lie on the face rather than along the skyline: a run drawn on the
 * silhouette edge reads as an outline being highlighted, not as a line down the
 * mountain. They converge at the summit the way runs converge on a trail map.
 *
 * They carry no difficulty colour. Grade is real data (SPEC §6) and this is an
 * invented mountain, so tinting them green and black would assert something the
 * figure cannot know.
 */
const RUN = [
  [1185, 46],
  [1152, 76],
  [1118, 104],
  [1080, 128],
  [1038, 150],
  [992, 172],
  [944, 192],
  [892, 212],
  [840, 228],
  [790, 242],
] as const satisfies readonly (readonly [number, number])[];

const TRAILS = [
  [
    [1180, 52],
    [1160, 86],
    [1136, 114],
    [1102, 134],
    [1068, 146],
    [1038, 150],
  ],
  [
    [1176, 58],
    [1146, 92],
    [1110, 122],
    [1068, 152],
    [1020, 178],
    [970, 196],
    [922, 206],
    [892, 212],
  ],
  [
    [1166, 70],
    [1120, 110],
    [1064, 148],
    [1002, 180],
    [936, 206],
    [866, 228],
    [790, 242],
  ],
  [
    [1196, 46],
    [1246, 94],
    [1300, 136],
    [1358, 174],
    [1420, 202],
    [1486, 224],
  ],
  [
    [1192, 54],
    [1224, 102],
    [1262, 140],
    [1310, 162],
    [1358, 174],
  ],
] as const satisfies readonly (readonly (readonly [number, number])[])[];

/** The lift's terminals: the run is the same span, ridden the other way. */
const BASE_INDEX = 8;
const SUMMIT_INDEX = 16;

/** Where the treeline sits in the viewBox, in the same units as the profile. */
const TREELINE_Y = 150;

const VIEW_W = 1800;
const VIEW_H = 300;

/** The elevation the viewBox spans, so the axis and the treeline agree. */
const ELEV_TOP = 2600;
const ELEV_BOTTOM = 1400;
const AXIS_TICKS = [2400, 2000, 1600];

/** Where the sun is, as a fraction of the width: the crest of the lit face. */
const SUN_BREAK = 1190 / VIEW_W;

/**
 * Illustration values for the run above — a diagram, not measurements, which is
 * why the header captions the figure as a sample section. When a resort bakes,
 * these come from its `runs.json` and the caption becomes the resort's name.
 * Field names mirror `Run` in lib/types.ts so the masthead and the real data
 * speak the same vocabulary.
 */
export const PROFILE_STATS = {
  pitch_avg_deg: 21,
  aspect_deg: 45,
  vertical_m: 604,
} as const;

type Point = readonly [number, number];

function toPath(points: readonly Point[]): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
}

function toArea(points: readonly Point[]): string {
  return `${toPath(points)} L${VIEW_W},${VIEW_H} L0,${VIEW_H} Z`;
}

/**
 * Catmull-Rom through the points, emitted as cubics. Runs are carved, not
 * folded: straight segments meeting at corners is most of why a drawn line
 * reads as a chart series rather than as a track down a slope.
 */
function toSmoothPath(points: readonly Point[]): string {
  if (points.length < 3) return toPath(points);
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** Ground height under an arbitrary x, so a tower can stand on the slope. */
function terrainYAt(x: number): number {
  for (let i = 1; i < PROFILE.length; i++) {
    const [x0, y0] = PROFILE[i - 1];
    const [x1, y1] = PROFILE[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return PROFILE[PROFILE.length - 1][1];
}

function yForElevation(metres: number): number {
  return ((ELEV_TOP - metres) / (ELEV_TOP - ELEV_BOTTOM)) * VIEW_H;
}

const RIDGE = toPath(PROFILE);
const TERRAIN = toArea(PROFILE);

const LIFT_BASE = PROFILE[BASE_INDEX];
const LIFT_TOP = PROFILE[SUMMIT_INDEX];
const LIFT = toPath([LIFT_BASE, LIFT_TOP]);

const TOWERS = [0.16, 0.33, 0.5, 0.67, 0.84].map((t) => {
  const x = LIFT_BASE[0] + (LIFT_TOP[0] - LIFT_BASE[0]) * t;
  const y = LIFT_BASE[1] + (LIFT_TOP[1] - LIFT_BASE[1]) * t;
  return { x, y, ground: terrainYAt(x) };
});

const DESCENT = toSmoothPath(RUN);
const TRAIL_PATHS = TRAILS.map(toSmoothPath);

const CHAIRS = ["", "masthead-chair-2", "masthead-chair-3"];

export function Ridgeline({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Diagram: a mountain drawn in profile under a low sun, with the treeline marked, a lift running up its face and a run traced back down it."
      className={className}
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMax slice"
        className="h-full w-full"
        aria-hidden="true"
      >
        <defs>
          {/* Hue carries the sun: warm into the light, cool over the crest. */}
          <linearGradient
            id="alpine"
            gradientUnits="userSpaceOnUse"
            x1="0"
            x2={VIEW_W}
            y1="0"
            y2="0"
          >
            <stop offset="0" stopColor="var(--color-sun)" stopOpacity="0.3" />
            <stop offset="0.42" stopColor="var(--color-sun)" stopOpacity="0.47" />
            <stop offset={SUN_BREAK} stopColor="var(--color-sun)" stopOpacity="0.34" />
            <stop offset="0.73" stopColor="var(--color-shade-dim)" stopOpacity="0.68" />
            <stop offset="1" stopColor="var(--color-shade-dim)" stopOpacity="0.82" />
          </linearGradient>
          {/* Value carries the treeline: the same light, several stops darker. */}
          <linearGradient
            id="treed"
            gradientUnits="userSpaceOnUse"
            x1="0"
            x2={VIEW_W}
            y1="0"
            y2="0"
          >
            <stop offset="0" stopColor="var(--color-sun-dim)" stopOpacity="0.4" />
            <stop offset="0.42" stopColor="var(--color-sun-dim)" stopOpacity="0.52" />
            <stop offset={SUN_BREAK} stopColor="var(--color-shade-dim)" stopOpacity="0.6" />
            <stop offset="0.75" stopColor="var(--color-shadow-deep)" stopOpacity="0.86" />
            <stop offset="1" stopColor="var(--color-shadow-deep)" stopOpacity="0.95" />
          </linearGradient>

          {/* Alpine: the ground above the treeline. */}
          <clipPath id="above-treeline">
            <rect x="0" y="0" width={VIEW_W} height={TREELINE_Y} />
          </clipPath>
          {/* Below: the treed slopes. */}
          <clipPath id="below-treeline">
            <rect x="0" y={TREELINE_Y} width={VIEW_W} height={VIEW_H - TREELINE_Y} />
          </clipPath>
          {/* Keeps the other runs on the mountain rather than off its edge. */}
          <clipPath id="on-the-massif">
            <path d={TERRAIN} />
          </clipPath>
        </defs>

        {BACKDROPS.map((ridge) => (
          <path
            key={ridge.opacity}
            d={toArea(ridge.points)}
            fill="var(--color-shade)"
            fillOpacity={ridge.opacity}
          />
        ))}

        {/* The elevation the figure is drawn to, so it reads as a measurement
            and not a shape. The 2000 tick is the treeline's own height. */}
        <g className="u-data" fill="currentColor" stroke="currentColor">
          {AXIS_TICKS.map((metres) => (
            <g key={metres}>
              <line
                x1="40"
                y1={yForElevation(metres)}
                x2="64"
                y2={yForElevation(metres)}
                strokeWidth="1"
                strokeOpacity="0.5"
                vectorEffect="non-scaling-stroke"
              />
              <text x="74" y={yForElevation(metres)} dominantBaseline="middle" stroke="none">
                {metres}
              </text>
            </g>
          ))}
        </g>

        <g clipPath="url(#below-treeline)">
          <path d={TERRAIN} fill="url(#treed)" />
          <path
            d={RIDGE}
            fill="none"
            stroke="var(--color-shade)"
            strokeWidth="1.25"
            vectorEffect="non-scaling-stroke"
          />
        </g>

        <g clipPath="url(#above-treeline)">
          <path d={TERRAIN} fill="url(#alpine)" />
          <path
            d={RIDGE}
            fill="none"
            stroke="var(--color-snow)"
            strokeWidth="1.25"
            vectorEffect="non-scaling-stroke"
          />
        </g>

        <g clipPath="url(#on-the-massif)">
          {TRAIL_PATHS.map((d) => (
            <path
              key={d}
              className="masthead-trail"
              d={d}
              fill="none"
              stroke="var(--color-snow)"
              strokeOpacity="0.28"
              strokeWidth="1.25"
              strokeLinecap="round"
              pathLength="1"
              strokeDasharray="1 1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        {/* The boundary the project is named after, drawn and labelled the way a
            map draws one — dashed, and level, because a treeline is an elevation. */}
        <line
          x1="0"
          y1={TREELINE_Y}
          x2={VIEW_W}
          y2={TREELINE_Y}
          stroke="var(--color-line)"
          strokeWidth="1"
          strokeDasharray="7 5"
          vectorEffect="non-scaling-stroke"
        />
        {/* Centred so `slice` cropping at narrow widths never takes the label. */}
        <text
          x={VIEW_W / 2}
          y={TREELINE_Y - 13}
          textAnchor="middle"
          className="u-data"
          fill="currentColor"
        >
          Treeline
        </text>

        {/* The lift: towers standing on the slope, then the cable they carry. */}
        <g stroke="var(--color-rock-dim)">
          {TOWERS.map((tower) => (
            <line
              key={tower.x}
              x1={tower.x}
              y1={tower.y}
              x2={tower.x}
              y2={tower.ground}
              strokeWidth="1.25"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={LIFT} fill="none" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </g>

        {CHAIRS.map((modifier, i) => (
          <g
            key={i}
            className={`masthead-chair ${modifier}`}
            style={{ offsetPath: `path("${LIFT}")` }}
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="9"
              stroke="var(--color-rock)"
              strokeWidth="1.25"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1="-4.5"
              y1="9"
              x2="4.5"
              y2="9"
              stroke="var(--color-snow)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}

        <path
          className="masthead-trace"
          d={DESCENT}
          fill="none"
          stroke="var(--color-sun)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength="1"
          strokeDasharray="1 1"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          className="masthead-skier"
          r="13"
          fill="var(--color-sun)"
          fillOpacity="0.18"
          style={{ offsetPath: `path("${DESCENT}")` }}
        />
        <circle
          className="masthead-skier"
          r="4.5"
          fill="var(--color-sun-bright)"
          style={{ offsetPath: `path("${DESCENT}")` }}
        />
      </svg>
    </span>
  );
}
