import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ConditionsStrip } from "@/components/conditions-strip";
import { RunExplorer } from "@/components/run-explorer";
import { metres } from "@/lib/format";
import { readManifest, readMountain, readResort, readRuns } from "@/lib/manifest";

export async function generateStaticParams() {
  const manifest = await readManifest();
  return manifest.resorts.map((resort) => ({ slug: resort.slug }));
}

export async function generateMetadata(props: PageProps<"/resorts/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const resort = await readResort(slug);
  if (!resort) return {};

  return {
    title: resort.name,
    description: `${resort.name} terrain in 3D, from a 30m elevation model: ${metres(resort.elevation_min_m)} to ${metres(resort.elevation_max_m)}.`,
  };
}

export default async function ResortPage(props: PageProps<"/resorts/[slug]">) {
  const { slug } = await props.params;
  const resort = await readResort(slug);
  if (!resort) notFound();

  const runs = await readRuns(slug);
  const mountain = await readMountain(slug);

  // Facts rather than a description: what this is, where it came from and when.
  // They are also the whole of the page without WebGL, so they are plain HTML
  // served with the document rather than anything the scene produces (SPEC §9).
  const facts = [
    ["Country", resort.country],
    ["Elevation", `${metres(resort.elevation_min_m)}–${metres(resort.elevation_max_m)}`],
    // A dash, not a zero: readRuns returns null for a missing or malformed
    // artifact as well as for a resort with no runs, and only the last of those
    // is a fact about the mountain.
    ["Marked runs", runs ? `${runs.runs.length}` : "—"],
    // Beside the runs rather than below the table, which is where the lift list
    // itself has to go: a hundred and sixty-eight rows above it is a long way
    // to scroll before finding out the mountain has lifts at all.
    ["Lifts", mountain ? `${mountain.lifts.length}` : "—"],
    // The view is stretched vertically to read as a mountain; the numbers are
    // not. Saying which is which is the honest half of that trade.
    ["Vertical scale", `×${resort.vertical_exaggeration}`],
    ["Baked", resort.baked_at],
  ] as const;

  return (
    <main>
      <RunExplorer
        lifts={mountain?.lifts ?? []}
        places={mountain?.places ?? []}
        resort={resort}
        runs={runs?.runs ?? []}
      >
        {/* Over the terrain, and deliberately not in its way: only the link is
            clickable, so a drag anywhere else still turns the mountain. Server
            rendered and passed through, so the facts stay in the document. */}
        <header className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-shadow-deep via-shadow-deep/85 via-85% to-transparent">
          <div className="px-6 pt-8 pb-12">
            <Link className="u-data pointer-events-auto transition-colors hover:text-snow" href="/">
              ← Treeline
            </Link>
            <h1 className="u-massif mt-3 text-2xl text-snow sm:text-3xl">{resort.name}</h1>

            <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt className="u-data">{label}</dt>
                  <dd className="u-feature text-sm text-snow tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            {/* Separate from the facts above on purpose: those are terrain,
                measured once and dated; these are somebody else's model, read a
                moment ago. Merging them into one list would blur which is which. */}
            <ConditionsStrip slug={resort.slug} />
          </div>
        </header>
      </RunExplorer>
    </main>
  );
}
