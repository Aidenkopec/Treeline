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

  // Plain HTML served with the document rather than anything the scene produces (SPEC §9).
  const facts: Fact[] = [
    { label: "Country", value: resort.country },
    {
      label: "Elevation",
      value: `${metres(resort.elevation_min_m)}–${metres(resort.elevation_max_m)}`,
    },
    // A dash, not a zero: readRuns also returns null for a missing or malformed artifact.
    { label: "Marked runs", value: runs ? `${runs.runs.length}` : "—" },
    { label: "Lifts", value: mountain ? `${mountain.lifts.length}` : "—" },
    // The view is stretched vertically; the numbers are not, so the factor is stated.
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
