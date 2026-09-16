import Link from "next/link";
import type { Metadata } from "next";
import { DifficultyMark } from "@/components/difficulty-mark";
import { MastheadFigure } from "@/components/masthead-figure";
import { ResortIndex } from "@/components/resort-index";
import { SiteFooter } from "@/components/site-footer";
import { difficultyStyle } from "@/lib/difficulty";
import { HERO_SLUG, readResortFeatures, silhouettes } from "@/lib/masthead";
import { runCells } from "@/lib/run-list";

export const metadata: Metadata = {
  description:
    "Six ski resorts rebuilt from elevation data, with pitch, aspect, vertical and length measured for every marked run, and the sun and shade on them at any hour.",
};

/** What a resort page shows, in the order a visitor meets it there. */
const FEATURES = [
  [
    "The mountain in 3D",
    "Terrain from a 30m elevation model, with satellite imagery draped over it. Runs are drawn where they actually run.",
  ],
  [
    "Sun and shade",
    "Move the sun to any hour of any day, and watch the shade move across the real terrain with it.",
  ],
  [
    "Five numbers per run",
    "Average pitch, steepest pitch, the direction it faces, vertical and length, measured along the run itself.",
  ],
  [
    "Filter, sort, search",
    "Narrow a mountain by grade, by direction, or by minimum vertical. The same filters drive the map and the table.",
  ],
  [
    "Lifts and places",
    "Every lift on its surveyed towers, with its rise and length. Lodges, peaks and viewpoints labelled by name.",
  ],
  [
    "Send the exact view",
    "Today's snow, wind and temperature from Open-Meteo. Pick a run and an hour, and both go into the address.",
  ],
] as const;

/** How the numbers are arrived at. Sources are the footer's job (SPEC §8). */
const METHOD = [
  [
    "25m",
    "We take a height reading every 25 metres down each run. Those readings are what the steepness, the drop and the length are worked out from.",
  ],
  [
    "30m",
    "The ground map underneath has one height reading every 30 metres. That is why figures are rounded to whole degrees and whole metres: anything finer would be guesswork.",
  ],
  [
    "Once",
    "Every mountain was measured in advance and the answers saved with the page, so nothing is being worked out while you read. That is why it loads straight away.",
  ],
  [
    "Today",
    "Snow, wind and temperature are the only numbers fetched live. They arrive when you open a resort, shown in that mountain's local time.",
  ],
] as const;

export default async function Home() {
  const features = await readResortFeatures();
  const shapes = silhouettes(features, 220, 56);

  const hero = features.find((f) => f.planned.slug === HERO_SLUG && f.run !== null);
  const runCount = features.reduce((total, f) => total + f.runCount, 0);
  const liftCount = features.reduce((total, f) => total + f.liftCount, 0);
  const measured = features.filter((f) => f.resort !== null).length;

  const cells = hero?.run ? runCells(hero.run) : null;
  const grade = hero?.run ? difficultyStyle(hero.run.difficulty) : null;

  return (
    <main>
      <header className="border-b border-line bg-shadow-deep">
        <div className="mx-auto max-w-5xl px-6 pt-16 pb-10">
          <p className="u-data">
            {measured} resorts · {runCount} marked runs · {liftCount} lifts
          </p>
          <h1 className="u-massif mt-2 text-2xl text-snow sm:text-3xl">Treeline</h1>

          <p className="mt-5 max-w-[56ch] text-lg text-rock">
            Resort trail maps flatten the mountain. Treeline draws every marked run on the terrain
            it actually crosses, with pitch, aspect, vertical and length measured from a 30m
            elevation model, and the sun and shade on them at any hour of any day.
          </p>

          {hero?.run && cells && grade && (
            <div className="mt-8">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="u-feature text-base text-snow">
                  {hero.planned.name} · {cells.name}
                </h2>
                <span className="flex items-center gap-1.5">
                  <DifficultyMark difficulty={hero.run.difficulty} />
                  <span className="u-data">{grade.label}</span>
                </span>
              </div>

              <dl className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                {(
                  [
                    ["Avg pitch", cells.pitchAvg],
                    ["Steepest", cells.pitchMax],
                    ["Aspect", cells.aspect],
                    ["Vertical", cells.vertical],
                    ["Length", cells.length],
                  ] as const
                ).map(([label, value]) => (
                  <div
                    className="flex items-baseline gap-1.5 after:text-rock-dim after:content-['·'] last:after:content-none"
                    key={label}
                  >
                    <dt className="u-data">{label}</dt>
                    <dd className="u-feature text-sm text-snow tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>

              <p className="u-data mt-3 max-w-[60ch] normal-case">
                Aspect is the compass direction a slope faces, which decides when the sun reaches
                it. The profile below is stretched to fill its frame; the numbers are not.
              </p>

              <Link
                className="u-feature mt-7 inline-flex items-center gap-2 rounded border border-sun bg-sun-dim/30 px-4 py-2.5 text-sm text-snow transition-colors hover:bg-sun-dim/50"
                href={`/resorts/${hero.planned.slug}#run=${hero.run.id}`}
              >
                Open {hero.planned.name} in 3D
                <span aria-hidden="true">→</span>
              </Link>
              <p className="u-data mt-2">Opens with this run selected</p>
            </div>
          )}
        </div>

        {/* In flow under the text rather than behind it: the run is 1200 units
              wide and the block above is taller than any scrim holds, so type
              laid over it would sit in the veil's run-out. */}
        {hero?.run && (
          <MastheadFigure
            className="mx-auto max-w-5xl px-6 pb-10 [&>svg]:aspect-[5/1] [&>svg]:min-h-32"
            profile={hero.run.profile}
          />
        )}
      </header>

      <section className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="u-massif text-sm text-snow">The mountains</h2>
        <div className="mt-5">
          <ResortIndex features={features} silhouettes={shapes} />
        </div>
        <p className="u-data mt-4 max-w-[70ch] normal-case">
          Each profile draws one named run at that resort, all six at one scale, so a short steep
          run reads steep beside a long shallow one.
        </p>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <h2 className="u-massif text-sm text-snow">On every resort page</h2>
          <ul className="mt-7 grid gap-x-12 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([title, body]) => (
              <li className="border-t border-line pt-4" key={title}>
                <h3 className="u-feature text-base text-snow">{title}</h3>
                <p className="mt-2 max-w-[38ch] text-sm text-rock">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <h2 className="u-massif text-sm text-snow">How it is measured</h2>
          <dl className="mt-6 divide-y divide-line border-y border-line">
            {METHOD.map(([figure, note]) => (
              <div className="grid gap-x-8 gap-y-1 py-4 sm:grid-cols-[7rem_1fr]" key={figure}>
                <dt className="u-feature text-base text-snow tabular-nums">{figure}</dt>
                <dd className="max-w-[72ch] text-sm text-rock">{note}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
