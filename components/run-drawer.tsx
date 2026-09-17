"use client";

import type { ReactNode, Ref } from "react";

/**
 * Written as `transform` rather than a `translate-y-*` utility, which sets a custom
 * property registered `syntax: "*"` and so holds its start value for the length of the
 * transition instead of interpolating. The dock above `xl` still moves on the utility.
 */
const PEEK_HANDHELD =
  "handheld:[transform:translateY(calc(62svh-8.5rem-env(safe-area-inset-bottom)))] squat:[transform:translateY(calc(92svh-2.75rem))]";
const PEEK = `[transform:translateY(calc(62svh-8.5rem))] ${PEEK_HANDHELD}`;

/**
 * The run list, docked beside the mountain or drawn up over it. Opaque because a backdrop
 * filter over a live canvas costs the frame rate SPEC §10 budgets for. Hidden, never
 * unmounted: without WebGL this table is the site, so the rows stay in the document (§9).
 */
export function RunDrawer({
  children,
  collapsible,
  head,
  onToggle,
  open,
  ref,
  untouched,
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
  /**
   * True until the reader has said. The server cannot measure a window, so the
   * phone's own default is left to the media query: resolved in JavaScript it
   * would paint the list over the mountain until hydration.
   */
  untouched: boolean;
}) {
  return (
    <aside
      className={`fixed inset-x-0 bottom-0 z-30 flex h-[62svh] flex-col rounded-t-xl border-t border-line bg-shadow shadow-panel transition-transform duration-200 ease-out xl:inset-y-0 xl:right-0 xl:left-auto xl:h-svh xl:w-152 xl:rounded-none xl:border-t-0 xl:border-l 2xl:w-168 handheld:h-[calc(62svh-env(safe-area-inset-bottom))] squat:h-[92svh] squat:pr-[env(safe-area-inset-right)] squat:pl-[env(safe-area-inset-left)] ${
        open
          ? `[transform:none] xl:translate-x-0 ${untouched ? PEEK_HANDHELD : ""}`
          : `${PEEK} xl:translate-x-full xl:[transform:none]`
      }`}
      id="run-list"
      ref={ref}
      tabIndex={-1}
    >
      {collapsible && (
        <>
          {/* The sheet's own grab bar, and the only way back to the map on a phone.
              Wide and labelled: it is reached for first and has least room to hunt in. */}
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

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-10 handheld:pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
        {children}
      </div>
    </aside>
  );
}
