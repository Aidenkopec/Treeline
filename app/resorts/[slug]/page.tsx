import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TerrainViewer } from "@/components/terrain-viewer";
import { metres } from "@/lib/format";
import { readManifest, readResort, readRuns } from "@/lib/manifest";

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

  // Facts rather than a description: what this is, where it came from and when.
  // They are also the whole of the page without WebGL, so they are plain HTML
  // served with the document rather than anything the scene produces (SPEC §9).
  const facts = [
    ["Country", resort.country],
    ["Elevation", `${metres(resort.elevation_min_m)}–${metres(resort.elevation_max_m)}`],
    ["Marked runs", `${runs?.runs.length ?? 0}`],
    // The view is stretched vertically to read as a mountain; the numbers are
    // not. Saying which is which is the honest half of that trade.
    ["Vertical scale", `×${resort.vertical_exaggeration}`],
    ["Baked", resort.baked_at],
  ] as const;

  return (
    <main>
      <section className="relative border-b border-line bg-shadow">
        <TerrainViewer resort={resort} />

        {/* Over the terrain, and deliberately not in its way: only the link is
            clickable, so a drag anywhere else still turns the mountain. */}
        <header className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-shadow-deep via-shadow-deep/75 to-transparent">
          <div className="mx-auto max-w-5xl px-6 pt-8 pb-28">
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
          </div>
        </header>
      </section>
    </main>
  );
}
