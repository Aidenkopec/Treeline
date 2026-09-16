"use client";

import { useState } from "react";

/**
 * The disclaimer and the credits, on the map and never scrolled to.
 *
 * SPEC §8 requires the disclaimer on every page and the licences behind the
 * data require credit wherever it is shown. In a window the mountain fills
 * there is nothing below the fold to put it under, so it is here, on the map,
 * and it stays there while the drawer comes and goes.
 *
 * Two obligations, two treatments. The safety line is out at all times, in the
 * words that carry the warning; the credits fold behind the button, which is
 * what the OSMF attribution guidelines allow for a map that cannot spare the
 * room and what every slippy map does. Folded, the bar is a corner pill rather
 * than a band across the window — a band of type is the brightest thing on the
 * page competing with the mountain the page is about.
 *
 * Abbreviating the visible line is what the button pays for: the §8 sentence in
 * full is one press away, and `components/site-footer.tsx` says it and the
 * credits again at the foot of the list. Neither is ever the only copy.
 *
 * A snowfield is the brightest thing on this page and it is exactly what the
 * bottom edge is full of, so the line is set over a scrim rather than trusted
 * to the terrain behind it. Only the link and the button take the pointer: the
 * rest of the bar is still mountain to drag.
 *
 * Avalanche information appears as a plain outbound link and in no other form.
 */

const LINK =
  "pointer-events-auto underline decoration-line underline-offset-2 transition-colors hover:text-snow";

export function MapAttribution() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative w-fit max-w-full">
      {open && (
        // Opaque, unlike the chrome around it: the only room above the line is
        // the sun panel's, and two translucent surfaces stacked read as neither.
        <div
          className="u-panel pointer-events-auto absolute bottom-full mb-2 flex w-84 max-w-[calc(100vw-2.5rem)] flex-col gap-2 bg-surface p-3 text-xs leading-relaxed text-rock"
          id="map-credits"
        >
          <p>
            Terrain data is approximate, derived from 30m elevation models. Not for navigation or
            safety decisions. Check{" "}
            <a
              className={LINK}
              href="https://avalanche.ca"
              rel="noreferrer noopener"
              target="_blank"
            >
              avalanche.ca
            </a>{" "}
            and resort reports before skiing.
          </p>
          <p>
            Elevation from{" "}
            <a
              className={LINK}
              href="https://registry.opendata.aws/terrain-tiles/"
              rel="noreferrer noopener"
              target="_blank"
            >
              AWS Terrain Tiles
            </a>
            . Winter surface from Esri World Imagery. Runs from{" "}
            <a
              className={LINK}
              href="https://www.openstreetmap.org/copyright"
              rel="noreferrer noopener"
              target="_blank"
            >
              OpenStreetMap
            </a>{" "}
            contributors, ODbL. Weather from{" "}
            <a
              className={LINK}
              href="https://open-meteo.com"
              rel="noreferrer noopener"
              target="_blank"
            >
              Open-Meteo
            </a>
            .
          </p>
        </div>
      )}

      <div className="u-data flex w-fit max-w-full items-center gap-2 rounded bg-shadow-deep/75 px-2 py-1 leading-relaxed text-rock normal-case backdrop-blur-sm">
        <p>
          Terrain approximate · not for navigation or safety decisions ·{" "}
          <a className={LINK} href="https://avalanche.ca" rel="noreferrer noopener" target="_blank">
            avalanche.ca
          </a>
        </p>

        <button
          aria-controls="map-credits"
          aria-expanded={open}
          aria-label="Data sources and full disclaimer"
          className="pointer-events-auto shrink-0 cursor-pointer text-rock transition-colors hover:text-snow"
          onClick={() => setOpen(!open)}
          type="button"
        >
          <svg
            aria-hidden="true"
            fill="none"
            height="14"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 16 16"
            width="14"
          >
            <circle cx="8" cy="8" r="6.25" />
            <circle cx="8" cy="4.9" fill="currentColor" r="0.7" stroke="none" />
            <path d="M8 7.4v3.7" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
