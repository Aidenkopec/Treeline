"use client";

import { type ReactNode, useCallback, useEffect, useRef } from "react";
import type { Rect } from "@/lib/label-layout";

/**
 * Where everything that is not the mountain stands.
 *
 * Two edges rather than four corners. A masthead veils the top, an instrument
 * strip veils the bottom, and the selected run's numbers hang under the
 * masthead in the same left column — so the middle of the window, which is the
 * mountain, carries nothing.
 *
 * Both veils bleed to the frame's edges because a scrim with a margin of
 * un-dimmed sky beside it is not one. Neither takes the pointer: the clusters
 * inside them opt in one at a time, so the gaps between the controls are still
 * mountain to drag. A full-width band that took the pointer would stop the
 * bottom of the window turning the terrain at all.
 *
 * The selection is its own box and not part of the masthead, though it reads as
 * one column with it. The masthead's measured height is `inset.top`, which the
 * scene composes the massif below: fold the card into it and the camera
 * re-projects every time a run is picked.
 *
 * It reports what it covers. The label pass places plates in screen space and
 * knows nothing of the DOM outside the canvas, so without this a lift name
 * lands under the sun clock, or across the resort's own facts, and is gone.
 */
export function MapChrome({
  disclaimer,
  instruments,
  listOpen,
  masthead,
  onMeasure,
  selection,
}: {
  /** The disclaimer. Always rendered, whatever the drawer is doing (SPEC §8). */
  disclaimer: ReactNode;
  /** The sun, the grades and the way back. Absent without a GPU. */
  instruments: ReactNode;
  /** Whether the drawer is out, which is what the right inset is measured on. */
  listOpen: boolean;
  /** The resort's name and facts, full bleed across the top. */
  masthead: ReactNode;
  /** Told where the clusters landed, in canvas pixels. Must be stable. */
  onMeasure: (rects: Rect[]) => void;
  /** The selected run's numbers, continuing the masthead's column. */
  selection: ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);

  // The canvas is the same box as this one, pinned at the same origin, so a
  // client rect is already in the coordinates the label pass projects into.
  const read = useCallback(() => {
    const root = frame.current;
    if (root === null) return;

    const rects: Rect[] = [];
    for (const cluster of root.querySelectorAll<HTMLElement>("[data-chrome]")) {
      const { x, y, width, height } = cluster.getBoundingClientRect();
      if (width > 0 && height > 0) rects.push({ x, y, width, height });
    }
    onMeasure(rects);
  }, [onMeasure]);

  // A cluster changes shape on its own as well as with the window — the detail
  // card arrives, the weather lands, the count goes from three digits to two —
  // so every render is measured. It is a handful of rects, and `onMeasure`
  // drops an answer it already has.
  useEffect(read);

  useEffect(() => {
    const root = frame.current;
    if (root === null) return;

    const observer = new ResizeObserver(read);
    observer.observe(root);
    return () => observer.disconnect();
  }, [read]);

  return (
    // The inset is the drawer's own width, so both veils run to its edge.
    <div
      className={`pointer-events-none absolute inset-0 z-20 flex flex-col ${
        listOpen ? "xl:pr-152 2xl:pr-168" : ""
      }`}
      ref={frame}
    >
      <div data-chrome>{masthead}</div>

      {/* Same gutter as the masthead's, so the run's name starts on the column
          the resort's name started. Kept to its own width: a full-bleed rect
          here would reserve the middle of the window against lift labels. */}
      <div className="min-h-0 flex-1 px-6 pt-1">
        <div className="w-fit max-w-full" data-chrome>
          {selection}
        </div>
      </div>

      {/* Raised, the sheet is most of a narrow window and this strip is behind
          it. Rendering it there would be chrome nobody can reach, and the
          disclaimer it carries is at the foot of the sheet's own scroll. */}
      <div
        className={`pb-38 xl:pb-0 handheld:pb-34 squat:pb-11 ${listOpen ? "max-xl:hidden" : ""}`}
      >
        {/* The gradient is on the content box rather than on the clearance
            above the sheet, so its dark end lands under the type it is for. */}
        <div
          className="u-scrim u-scrim-up flex flex-col gap-2.5 px-5 pt-8 pb-4 handheld:pt-5 handheld:pr-[max(1.25rem,env(safe-area-inset-right))] handheld:pl-[max(1.25rem,env(safe-area-inset-left))]"
          data-chrome
        >
          {instruments}
          {disclaimer}
        </div>
      </div>
    </div>
  );
}
