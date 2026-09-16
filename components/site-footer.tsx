/**
 * Disclaimer, framing and attribution.
 *
 * SPEC §8 requires the disclaimer on *every* page, and the licences behind the
 * data (ODbL for OSM, attribution for Esri and AWS) require credit wherever it
 * is shown. Each page renders this itself rather than inheriting it from the
 * root layout: the resort screen is a window the mountain fills, with nothing
 * below the fold to put a footer under, so it carries this at the foot of the
 * run list and `components/map-attribution.tsx` in the corner of the map — the
 * copy that cannot be folded away. A page added later has to say which it is.
 *
 * Avalanche information appears here as a plain outbound link and in no other
 * form — no rating, no color, no icon, no summary.
 *
 * The source link sits here rather than in a nav bar: this renders on every
 * page, and the resort screen has no room for chrome that is not the map's.
 */
export function SiteFooter() {
  return (
    <footer className="@container border-t border-line bg-shadow py-10 text-xs text-rock-dim">
      <div className="mx-auto max-w-5xl px-6">
        <p className="max-w-[68ch] text-sm text-rock">
          Treeline covers marked, inbounds runs at lift-served resorts. It is not a backcountry
          planning tool.
        </p>
        {/* Side by side once the footer itself is wide enough, which is a
            container query and not a viewport one: this also renders in the
            resort drawer, where the viewport is wide and the column is not. */}
        <div className="mt-5 grid gap-x-12 gap-y-4 @3xl:grid-cols-2">
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

        <p className="mt-5">
          Open source, MIT licensed.{" "}
          <a
            className="text-rock underline decoration-line underline-offset-2 transition-colors hover:text-snow hover:decoration-rock"
            href="https://github.com/Aidenkopec/Treeline"
            rel="noreferrer noopener"
            target="_blank"
          >
            Source on GitHub
          </a>
          <span aria-hidden="true"> ↗</span>
        </p>
      </div>
    </footer>
  );
}
