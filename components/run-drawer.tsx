"use client";

import type { ReactNode, Ref } from "react";

/**
 * The run list, docked beside the mountain or drawn up over it.
 *
 * Opaque, unlike the chrome that floats on the terrain: this is a reading
 * surface for a hundred and sixty-eight rows of numerals, and a backdrop filter
 * over a live canvas across a quarter of the window is the cheapest way to lose
 * the frame rate SPEC §10 budgets for.
 *
 * Hidden, never unmounted. Without WebGL this table is the site, so the rows
 * have to stay in the document for it to be (SPEC §9) — which is also why it
 * opens by default and why `open` is what the prerendered HTML carries.
 *
 * One boolean, two idioms: on a wide window `open` docks or retracts a panel at
 * the right edge; on a narrow one it raises or lowers a sheet from the bottom,
 * which never drops below its own head.
 */
export function RunDrawer({
  children,
  collapsible,
  head,
  onToggle,
  open,
  ref,
}: {
  /** The list itself. Scrolls under `head`. */
  children: ReactNode;
  /** False without a GPU, where this is the site and folding it hides it. */
  collapsible: boolean;
  /** Search, filters and the count. Stays put while the list moves under it. */
  head: ReactNode;
  onToggle: () => void;
  open: boolean;
  /** Held by the explorer, which measures what this covers for the camera. */
  ref?: Ref<HTMLElement>;
}) {
  return (
    <aside
      className={`fixed inset-x-0 bottom-0 z-30 flex h-[62svh] flex-col rounded-t-xl border-t border-line bg-shadow shadow-panel transition-transform duration-200 ease-out xl:inset-y-0 xl:right-0 xl:left-auto xl:h-svh xl:w-152 xl:rounded-none xl:border-t-0 xl:border-l 2xl:w-168 ${
        open
          ? "translate-y-0 xl:translate-x-0"
          : "translate-y-[calc(62svh-8.5rem)] xl:translate-x-full xl:translate-y-0"
      }`}
      id="run-list"
      ref={ref}
      tabIndex={-1}
    >
      {collapsible && (
        <>
          {/* The sheet's own grab bar, and the only way back to the map on a
              phone. Wide and labelled rather than a bare glyph: it is the
              control a reader reaches for first and has least room to hunt
              for. */}
          <button
            aria-controls="run-list"
            aria-expanded={open}
            className="u-data flex w-full shrink-0 cursor-pointer items-center justify-center gap-2 py-2.5 text-rock transition-colors hover:text-snow xl:hidden"
            onClick={onToggle}
            type="button"
          >
            <span aria-hidden="true">{open ? "▾" : "▴"}</span>
            {open ? "Show the mountain" : "Show the runs"}
          </button>

          {/* Rides the drawer's own edge, so it is beside the panel when the
              panel is out and at the window's edge when it is away. */}
          <div className="pointer-events-none absolute top-5 left-0 hidden -translate-x-full pr-2 xl:block">
            <button
              aria-controls="run-list"
              aria-expanded={open}
              className="u-panel u-data pointer-events-auto flex cursor-pointer items-center gap-2 px-3 py-2 text-rock transition-colors hover:text-snow"
              onClick={onToggle}
              type="button"
            >
              <span aria-hidden="true">{open ? "→" : "←"}</span>
              {open ? "Hide runs" : "Show runs"}
            </button>
          </div>
        </>
      )}

      <div
        className={`shrink-0 border-b border-line px-5 pb-4 ${collapsible ? "pt-1" : "pt-5"} xl:pt-5`}
      >
        {head}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-10">{children}</div>
    </aside>
  );
}
