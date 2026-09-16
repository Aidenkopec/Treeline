import { profileGeometry, type ProfileGeometry } from "./profile-path";
import { plannedResorts, readManifest, readMountain, readRuns } from "./manifest";
import type { Resort, Run } from "./types";

/**
 * The runs the home page draws.
 *
 * Held by OSM way id rather than chosen at build time. The rule that picked
 * them, the deepest named way whose profile descends throughout, is a
 * property of six committed artifacts, not of a function worth shipping, and
 * `tests/masthead.test.ts` fails if a re-bake drops or reshapes one. A rule
 * evaluated here would instead swap the figure for a different run and say
 * nothing.
 */
export const FEATURED: Record<string, string> = {
  fernie: "371431589",
  kimberley: "374491391",
  "lake-louise": "883614839",
  niseko: "213556371",
  panorama: "777349974",
  "sunshine-village": "23302115",
};

/** The one the masthead draws, and the resort the page's call to action opens. */
export const HERO_SLUG = "panorama";

/** A resort, the run that draws it, and what it was baked with. */
export interface ResortFeature {
  resort: Resort | null;
  planned: { slug: string; name: string; country: string };
  run: Run | null;
  runCount: number;
  liftCount: number;
}

export function featuredRun(slug: string, runs: Run[]): Run | null {
  const id = FEATURED[slug];
  return runs.find((run) => run.id === id) ?? null;
}

/** Every planned resort in `resorts.json` order, baked or not. */
export async function readResortFeatures(): Promise<ResortFeature[]> {
  const manifest = await readManifest();
  const baked = new Map(manifest.resorts.map((r) => [r.slug, r]));

  return Promise.all(
    plannedResorts().map(async ({ slug, name, country }) => {
      const [runsFile, mountain] = await Promise.all([readRuns(slug), readMountain(slug)]);
      return {
        resort: baked.get(slug) ?? null,
        planned: { slug, name, country },
        run: runsFile ? featuredRun(slug, runsFile.runs) : null,
        runCount: runsFile?.runs.length ?? 0,
        liftCount: mountain?.lifts.length ?? 0,
      };
    }),
  );
}

/**
 * One run's profile against the largest of the set.
 *
 * Deliberately carries no name: Niseko's featured run is `ホリデーコース` and
 * Archivo is loaded latin-subset, so a name that reached this page would render
 * as tofu.
 */
export interface Silhouette {
  slug: string;
  geometry: ProfileGeometry;
  /** The sub-box this run fills inside the shared frame, user units. */
  width: number;
  height: number;
}

/**
 * The featured runs drawn to one scale.
 *
 * `profileGeometry` normalises both axes into the box it is given, so six
 * profiles each filling their own cell would draw six near-identical diagonals.
 * Sizing each sub-box by the run's own baked `vertical_m` and `length_m`
 * against the largest of the six makes the column comparable: a short steep run
 * reads steep beside a long shallow one.
 */
export function silhouettes(
  features: ResortFeature[],
  width: number,
  height: number,
): Silhouette[] {
  const drawn = features.filter((f) => f.run !== null);
  if (drawn.length === 0) return [];

  const longest = Math.max(...drawn.map((f) => f.run!.length_m));
  const deepest = Math.max(...drawn.map((f) => f.run!.vertical_m));

  return drawn.map((f) => {
    const run = f.run!;
    const w = longest === 0 ? width : (run.length_m / longest) * width;
    const h = deepest === 0 ? height : (run.vertical_m / deepest) * height;
    return {
      slug: f.planned.slug,
      geometry: profileGeometry(run.profile, w, h),
      width: w,
      height: h,
    };
  });
}
