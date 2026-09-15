import { DifficultyMark } from "@/components/difficulty-mark";
import { Ridgeline } from "@/components/ridgeline";
import { DIFFICULTY_ORDER, difficultyStyle } from "@/lib/difficulty";
import { plannedResorts, readManifest } from "@/lib/manifest";

export default async function Home() {
  const manifest = await readManifest();
  const baked = new Map(manifest.resorts.map((r) => [r.slug, r]));
  const resorts = plannedResorts();

  return (
    <main>
      <header className="relative overflow-hidden border-b border-line bg-shadow">
        <Ridgeline className="absolute inset-x-0 bottom-0 h-40 w-full opacity-70" />
        <div className="relative mx-auto max-w-5xl px-6 pt-20 pb-44 md:pb-48">
          <h1 className="u-massif text-2xl text-snow sm:text-3xl">Treeline</h1>
          <p className="mt-6 max-w-[54ch] text-lg text-rock">
            Resort trail maps flatten the mountain. This one doesn&rsquo;t: real pitch, aspect and
            vertical for every marked run, computed from elevation data and drawn on the terrain it
            actually crosses.
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="u-data">Resorts</h2>

        <ul className="mt-5 border-t border-line">
          {resorts.map((resort) => {
            const entry = baked.get(resort.slug);
            return (
              <li
                key={resort.slug}
                className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-line py-4"
              >
                <span className="u-feature min-w-52 text-lg text-snow">{resort.name}</span>
                <span className="u-data min-w-24">{resort.country}</span>
                <span className="u-data min-w-28 tabular-nums">
                  {Math.abs(resort.lat).toFixed(2)}°{resort.lat >= 0 ? "N" : "S"}
                </span>
                <span className="ml-auto text-sm tabular-nums">
                  {entry ? (
                    <span className="text-rock">baked {entry.baked_at.slice(0, 10)}</span>
                  ) : (
                    <span className="text-rock-dim">not baked</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>

        {manifest.resorts.length === 0 && (
          <div className="mt-8 border-l-2 border-sun-dim bg-surface/60 px-5 py-4">
            <p className="text-sm text-rock">
              No resort has been baked yet. Build one&rsquo;s terrain, imagery and runs with:
            </p>
            <p className="mt-3 font-mono text-sm text-sun [font-variant-ligatures:none]">
              npm run bake -- --resort lake-louise
            </p>
            <p className="mt-3 text-sm text-rock-dim">
              Check OSM coverage first with{" "}
              <span className="font-mono text-rock [font-variant-ligatures:none]">
                npm run bake -- --check lake-louise
              </span>
              .
            </p>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="u-data">Grades</h2>
        <p className="mt-3 max-w-[60ch] text-sm text-rock">
          Runs carry the grade their resort assigned them in OpenStreetMap. Plenty of runs are
          untagged, and those say so rather than being given a grade here.
        </p>

        <ul className="mt-5 flex flex-wrap gap-x-10 gap-y-3">
          {DIFFICULTY_ORDER.map((difficulty) => {
            const style = difficultyStyle(difficulty);
            return (
              <li key={style.label} className="flex items-center gap-2.5">
                <DifficultyMark difficulty={difficulty} />
                <span className="u-feature text-sm text-snow">{style.label}</span>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
