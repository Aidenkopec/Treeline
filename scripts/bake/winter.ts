/**
 * Esri's summer mosaic remapped to a winter surface. Keyed on the source pixel's colour
 * alone: keying snow on slope would shade the mountain by steepness (SPEC §8). Two classes,
 * no rock term, because the transfer must stay monotonic or it rims every snow patch grey.
 */

/**
 * Landcover tones answering to --color-shadow, --color-snow and --color-rock, as literals
 * because the bake has no DOM to read them from. FOREST_* spans a wide band on purpose: at
 * ~3 m/texel a narrow band averages a canopy into flat grey. Cool rather than green.
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
 * The two blur radii, in texels. Classification and canopy tone read the tighter plane so
 * a run corridor keeps its edges and a one-texel JPEG speck does not become a tree; the
 * snow tone reads the wider one so an open slope comes out smooth.
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
 * Remap a three-channel mosaic in place and hand it back. In place because Lake Louise's
 * mosaic is 18.9 MB raw and sharp's buffer is ours to write to.
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
