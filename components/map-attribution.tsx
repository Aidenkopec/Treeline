/**
 * The disclaimer and the credits, on the map and never scrolled to.
 *
 * SPEC §8 requires the disclaimer on every page and the licences behind the
 * data require credit wherever it is shown. In a window the mountain fills
 * there is nothing below the fold to put it under, so it is here, on the map,
 * and it stays there while the drawer comes and goes.
 *
 * `components/site-footer.tsx` says the same things at length at the foot of
 * the list, and is what carries them on a narrow window with the sheet raised —
 * there this line is behind it. Neither is ever the only copy.
 *
 * A snowfield is the brightest thing on this page and it is exactly what the
 * bottom edge is full of, so the line is set over a scrim rather than trusted
 * to the terrain behind it. Only the links take the pointer: the rest of the
 * bar is still mountain to drag.
 *
 * Avalanche information appears as a plain outbound link and in no other form.
 */

const LINK =
  "pointer-events-auto underline decoration-line underline-offset-2 transition-colors hover:text-snow";

export function MapAttribution() {
  return (
    <p className="u-data w-fit max-w-full rounded bg-shadow-deep/75 px-2 py-1 leading-relaxed text-rock normal-case backdrop-blur-sm">
      Terrain approximate, from 30m elevation models. Not for navigation or safety decisions. Check{" "}
      <a className={LINK} href="https://avalanche.ca" rel="noreferrer noopener" target="_blank">
        avalanche.ca
      </a>{" "}
      and resort reports. Data:{" "}
      <a
        className={LINK}
        href="https://www.openstreetmap.org/copyright"
        rel="noreferrer noopener"
        target="_blank"
      >
        OpenStreetMap
      </a>{" "}
      contributors (ODbL) · Esri World Imagery · AWS Terrain Tiles · Open-Meteo.
    </p>
  );
}
