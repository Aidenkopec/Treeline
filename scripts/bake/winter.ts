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
 * So there are two classes and not three. There is no rock term: a shadowed
 * cliff is already dark in the photograph, so it falls the forest side of the
 * split and takes the same cool dark tone, which is what a cliff band looks like
 * under snow anyway. A third class keyed on a *band* of brightness — which is
 * what this had — is a band-pass on the very quantity being remapped, and it
 * folds the transfer back on itself: brighter ground comes out darker, and the
 * fold draws a grey rim around every snow patch on the mountain. The transfer
 * below is monotonic, which is the property that keeps the rim away.
 */

/**
 * Landcover tones. Answering to --color-shadow, --color-snow and --color-rock,
 * matched here as literals because the bake has no DOM to read them from.
 *
 * FOREST_* is the dark half of the mountain, which is conifer by area but also
 * takes every cliff face the sun was not on. It spans a wide band on purpose, and this is the one place the remap
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

/** Where the landcover split sits, in source luminance. Measured over Lake Louise. */
const FOREST_EDGE = 88;
const SNOW_EDGE = 116;

/** The canopy stretch, in source luminance — see FOREST_DEEP above. */
const CANOPY_LOW = 30;
const CANOPY_HIGH = 95;

/**
 * The snow stretch. The top edge sits above the brightest ground in the mosaic
 * on purpose: an icefield that reaches it flattens to one colour, and a snowfield
 * with no tonal drift in it reads as paper.
 */
const FIELD_LOW = 100;
const FIELD_HIGH = 250;

/**
 * The two blur radii, in texels. Classification and canopy tone read the tighter
 * plane so a run corridor keeps its edges and a one-texel JPEG speck does not
 * become a tree; the snow tone reads the wider one so an open slope comes out
 * smooth.
 */
const CANOPY_SMOOTHING = 1;
const FIELD_SMOOTHING = 3;

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
  const crisp = blur(detail, width, height, CANOPY_SMOOTHING);
  const smoothed = blur(crisp, width, height, FIELD_SMOOTHING);

  for (let p = 0; p < count; p++) {
    const i = p * 3;
    const snow = smoothstep(FOREST_EDGE, SNOW_EDGE, crisp[p]);
    const canopy = smoothstep(CANOPY_LOW, CANOPY_HIGH, crisp[p]);
    const field = smoothstep(FIELD_LOW, FIELD_HIGH, smoothed[p]);

    for (let c = 0; c < 3; c++) {
      const trees = FOREST_DEEP[c] + (FOREST_OPEN[c] - FOREST_DEEP[c]) * canopy;
      const white = SNOW_LOW[c] + (SNOW_HIGH[c] - SNOW_LOW[c]) * field;
      rgb[i + c] = Math.round(trees + (white - trees) * snow);
    }
  }

  return rgb;
}
