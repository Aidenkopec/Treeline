/**
 * Disclaimer, framing and attribution.
 *
 * This sits in the root layout rather than on individual pages because SPEC §8
 * requires the disclaimer on *every* page, and the licences behind the data
 * (ODbL for OSM, attribution for Esri and AWS) require credit wherever it is
 * shown. Rendering it once, globally, is what keeps that true as pages are added.
 *
 * Avalanche information appears here as a plain outbound link and in no other
 * form — no rating, no color, no icon, no summary.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-shadow py-10 text-xs text-rock-dim">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6">
        <p className="max-w-[68ch] text-sm text-rock">
          Treeline covers marked, inbounds runs at lift-served resorts. It is not a backcountry
          planning tool.
        </p>
        <p className="max-w-[68ch]">
          Terrain data is approximate, derived from 30m elevation models. Not for navigation or
          safety decisions. Check{" "}
          <a
            className="text-rock underline decoration-line underline-offset-2 transition-colors hover:text-snow hover:decoration-rock"
            href="https://avalanche.ca"
            rel="noreferrer noopener"
            target="_blank"
          >
            avalanche.ca
          </a>{" "}
          and resort reports before skiing.
        </p>
        <p className="max-w-[68ch]">
          Elevation from{" "}
          <a
            className="hover:text-rock"
            href="https://registry.opendata.aws/terrain-tiles/"
            rel="noreferrer noopener"
            target="_blank"
          >
            AWS Terrain Tiles
          </a>
          . Winter surface rendered from Esri World Imagery. Runs and resort boundaries from{" "}
          <a
            className="hover:text-rock"
            href="https://www.openstreetmap.org/copyright"
            rel="noreferrer noopener"
            target="_blank"
          >
            OpenStreetMap
          </a>{" "}
          contributors, ODbL. Weather from{" "}
          <a
            className="hover:text-rock"
            href="https://open-meteo.com"
            rel="noreferrer noopener"
            target="_blank"
          >
            Open-Meteo
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
