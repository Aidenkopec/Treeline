/**
 * Esri's mosaic is a summer scene — green forest, bare rock — which reads as a
 * bike map on a ski site. This remaps it to a winter surface at bake time.
 *
 * Keyed on the source pixel's own colour and nothing else. Keying snow on slope
 * would shade the whole mountain by steepness, which SPEC §8 forbids, so the
 * heightmap is deliberately not a parameter here and must not become one.
 *
 * The first version of this recoloured the photograph and kept its detail, and
 * it read as a greyscale summer photograph — because a summer photograph's
 * detail is what says summer. Every tree crown and scree stipple survived.
 *
 * Snow blankets. It fills gullies, rounds edges and erases small detail, so an
 * open slope under snow is a smooth bright surface whose only variation is the
 * shape of the ground beneath it. That shape is the renderer's job, not this
 * one's: the mesh normals and the light already carry it, and the drape fighting
 * them with summer texture is what buried it.
 *
 * So the two halves of the image are treated as opposites. Snow is keyed and
 * toned from a blurred luminance, which throws the photograph's fine detail
 * away and leaves a smooth field. Forest keeps the sharp luminance, because
 * trees really are the texture at this scale. The gap between the two is wide
 * on purpose — in a real winter aerial the forest/snow contrast is enormous,
 * and closing it is what made earlier passes read as grey mush.
 */

/**
 * Landcover tones. Answering to --color-shadow, --color-snow and --color-rock,
 * matched here as literals because the bake has no DOM to read them from.
 *
 * Snow is near-white and spans a narrow band: the range it does have is there
 * so a snowfield is not a dead flat fill, and the light supplies the rest.
 * Rock is cool, because a warm grey reads as desert.
 *
 * Forest spans a wide band on purpose, and this is the one place the remap
 * wants more contrast rather than less. At ~3 m/texel a canopy is not resolved
 * into trees, so a narrow band averages it into flat grey and the treed half of
 * the massif reads as a smudge. Stretched, the crowns stay dark while the gaps
 * between them go bright, which is where the snow in a forest actually is.
 * Cool rather than green: green at this scale is the one thing that still says
 * summer.
 */
const FOREST_DEEP = [50, 58, 64];
const FOREST_OPEN = [136, 145, 152];
const SNOW_LOW = [204, 213, 221];
const SNOW_HIGH = [250, 252, 253];
const ROCK = [126, 137, 152];

/** Where the landcover split sits, in source luminance. Measured over Lake Louise. */
const FOREST_EDGE = 88;
const SNOW_EDGE = 116;

/**
 * Radius of the blur that the snow half is keyed and toned from, in texels.
 *
 * Small enough that a run corridor keeps its edges — they are ~10 texels wide
 * at this zoom — and large enough to take the canopy stipple out of the open
 * ground between them.
 */
const SMOOTHING = 3;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Separable box blur with clamped edges. Two passes over a scratch plane. */
function blur(source: Float32Array, width: number, height: number, radius: number): Float32Array {
  const span = radius * 2 + 1;
  const rows = new Float32Array(source.length);
  const out = new Float32Array(source.length);
  const clamp = (v: number, limit: number) => Math.min(limit - 1, Math.max(0, v));

  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    for (let x = -radius; x <= radius; x++) sum += source[row + clamp(x, width)];
    for (let x = 0; x < width; x++) {
      rows[row + x] = sum / span;
      sum += source[row + clamp(x + radius + 1, width)] - source[row + clamp(x - radius, width)];
    }
  }

  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) sum += rows[clamp(y, height) * width + x];
    for (let y = 0; y < height; y++) {
      out[y * width + x] = sum / span;
      sum +=
        rows[clamp(y + radius + 1, height) * width + x] -
        rows[clamp(y - radius, height) * width + x];
    }
  }

  return out;
}

/**
 * Remap a three-channel mosaic in place and hand it back.
 *
 * In place because Lake Louise's mosaic is 18.9 MB raw and sharp's buffer is
 * ours to write to. `stitchTiles` guarantees the three channels.
 */
export function winterize(rgb: Buffer, width: number, height: number): Buffer {
  const count = width * height;
  const detail = new Float32Array(count);
  for (let p = 0; p < count; p++) {
    const i = p * 3;
    detail[p] = 0.2126 * rgb[i] + 0.7152 * rgb[i + 1] + 0.0722 * rgb[i + 2];
  }
  const smoothed = blur(detail, width, height, SMOOTHING);

  for (let p = 0; p < count; p++) {
    const i = p * 3;
    const max = Math.max(rgb[i], rgb[i + 1], rgb[i + 2]);
    const saturation = max === 0 ? 0 : (max - Math.min(rgb[i], rgb[i + 1], rgb[i + 2])) / max;

    // Classified on the blurred plane so a bright pixel inside the canopy does
    // not punch a white speck through the trees.
    const snow = smoothstep(FOREST_EDGE, SNOW_EDGE, smoothed[p]);
    const canopy = smoothstep(30, 95, detail[p]);
    const field = smoothstep(96, 196, smoothed[p]);
    // Rock survives across the alpine mid-tones and lets go again at the
    // brightness of lying snow, so a cliff band keeps its colour while the
    // icefield above it does not. The saturation gate is tight because the ring
    // of ground around every snow patch sits at the same luminance as rock and
    // a loose one outlines all of them in grey.
    const rock =
      smoothstep(138, 170, smoothed[p]) *
      (1 - smoothstep(198, 224, smoothed[p])) *
      (1 - smoothstep(0.07, 0.15, saturation));

    for (let c = 0; c < 3; c++) {
      const trees = FOREST_DEEP[c] + (FOREST_OPEN[c] - FOREST_DEEP[c]) * canopy;
      const white = SNOW_LOW[c] + (SNOW_HIGH[c] - SNOW_LOW[c]) * field;
      const ground = trees + (white - trees) * snow;
      rgb[i + c] = Math.min(255, Math.round(ground + (ROCK[c] - ground) * rock * snow));
    }
  }

  return rgb;
}
