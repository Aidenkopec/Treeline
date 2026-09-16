import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Fact } from "@/components/resort-identity";
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
  // Formatted here so they are plain HTML served with the document rather than
  // anything the scene produces (SPEC §9), and folded away on the page because
  // the top of the massif is not somewhere to spend six permanent columns.
  const facts: Fact[] = [
    { label: "Country", value: resort.country },
    {
      label: "Elevation",
      value: `${metres(resort.elevation_min_m)}–${metres(resort.elevation_max_m)}`,
    },
    // A dash, not a zero: readRuns returns null for a missing or malformed
    // artifact as well as for a resort with no runs, and only the last of those
    // is a fact about the mountain.
    { label: "Marked runs", value: runs ? `${runs.runs.length}` : "—" },
    { label: "Lifts", value: mountain ? `${mountain.lifts.length}` : "—" },
    // The view is stretched vertically to read as a mountain; the numbers are
    // not. Saying which is which is the honest half of that trade.
    { label: "Vertical scale", value: `×${resort.vertical_exaggeration}` },
    { label: "Measured", value: resort.baked_at },
  ];

  return (
    <main>
      <RunExplorer
        facts={facts}
        lifts={mountain?.lifts ?? []}
        places={mountain?.places ?? []}
        resort={resort}
        runs={runs?.runs ?? []}
      />
    </main>
  );
}
