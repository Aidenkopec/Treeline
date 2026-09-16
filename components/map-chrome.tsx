"use client";

import { type ReactNode, useCallback, useEffect, useRef } from "react";
import type { Rect } from "@/lib/label-layout";

/**
 * Where everything that is not the mountain stands.
 *
 * A masthead across the top, then four clusters in four corners, all of them
 * anchored to the same safe area — the window inset by whatever the drawer is
 * covering. One inset, five consumers, and no rule needed for what happens when
 * two of them want the same edge: the detail card is diagonally opposite the
 * list, so they never meet.
 *
 * The masthead bleeds to the frame's edges because it is a fade rather than a
 * panel, and a scrim with a 20px margin of un-dimmed sky above it is not one.
 * It also keeps its own pointer rules: everything else here takes the pointer
 * back, the masthead lets it through to the mountain except on its one link.
 *
 * It reports what it covers. The label pass places plates in screen space and
 * knows nothing of the DOM outside the canvas, so without this a lift name
 * lands under the sun clock, or across the resort's own facts, and is gone.
 */
export function MapChrome({
  bottomLeft,
  bottomRight,
  footer,
  listOpen,
  masthead,
  onMeasure,
  topLeft,
}: {
  bottomLeft: ReactNode;
  bottomRight: ReactNode;
  /** The disclaimer. Always rendered, whatever the drawer is doing (SPEC §8). */
  footer: ReactNode;
  /** Whether the drawer is out, which is what the right inset is measured on. */
  listOpen: boolean;
  /** The resort's name and facts, full bleed across the top. */
  masthead: ReactNode;
  /** Told where the clusters landed, in canvas pixels. Must be stable. */
  onMeasure: (rects: Rect[]) => void;
  topLeft: ReactNode;
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
    // The inset is the drawer's own width, so the masthead runs to its edge and
    // the padded clusters below keep their gutter inside that.
    <div
      className={`pointer-events-none absolute inset-0 z-20 flex flex-col ${
        listOpen ? "xl:pr-152 2xl:pr-168" : ""
      }`}
      ref={frame}
    >
      <div data-chrome>{masthead}</div>

      <div className="flex min-h-0 flex-1 flex-col justify-between gap-4 p-5 pt-0 pb-38 xl:pb-5">
        <div
          className="flex min-h-0 w-fit max-w-full flex-col items-start gap-3 [&>*]:pointer-events-auto"
          data-chrome
        >
          {topLeft}
        </div>

        {/* Raised, the sheet is most of a narrow window and this row is behind
            it. Rendering it there would be chrome nobody can reach, and the
            disclaimer it carries is at the foot of the sheet's own scroll. */}
        <div className={`flex flex-col gap-2.5 ${listOpen ? "max-xl:hidden" : ""}`}>
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0 [&>*]:pointer-events-auto" data-chrome>
              {bottomLeft}
            </div>
            <div className="shrink-0 [&>*]:pointer-events-auto" data-chrome>
              {bottomRight}
            </div>
          </div>
          <div data-chrome>{footer}</div>
        </div>
      </div>
    </div>
  );
}
