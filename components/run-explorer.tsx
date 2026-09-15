"use client";

import { type ReactNode, useMemo, useState, useSyncExternalStore } from "react";
import { RunFilters } from "@/components/run-filters";
import { SunControl } from "@/components/sun-control";
import { RunPanel } from "@/components/run-panel";
import { RunTable } from "@/components/run-table";
import { TerrainViewer } from "@/components/terrain-viewer";
import {
  NO_FILTER,
  type RunFilter,
  type SortDirection,
  type SortKey,
  filterRuns,
  runCells,
  sortRuns,
} from "@/lib/run-list";
import { type WallClock, instantAt, openingWallClock } from "@/lib/sun";
import type { Resort, Run } from "@/lib/types";
import { type ViewState, parseViewHash, viewHash } from "@/lib/view-hash";

/**
 * One filter and one selection, driving the mountain and the table together.
 *
 * The state lives here because SPEC §9 requires both views to answer to the
 * same filters. Everything below is presentational, and the logic it needs is
 * in `lib/run-list.ts` where it can be tested without a DOM.
 *
 * `children` is the page's server-rendered header, passed through rather than
 * rebuilt, so the resort's facts stay in the document as plain HTML.
 */

/** Numeric columns open biggest-first; names and grades open at the top. */
const DESCENDING_FIRST: SortKey[] = ["vertical_m", "length_m", "pitch_avg_deg", "pitch_max_deg"];

/**
 * The selected run and the hour the sun is drawn at live in the URL, so a view
 * can be sent to someone.
 *
 * Read through `useSyncExternalStore` rather than an effect: the server has no
 * location to read, and the empty snapshot it returns is what lets the table
 * below prerender with every run in it. `useSearchParams` would do the same job
 * and take this whole subtree out of the prerendered HTML to do it.
 */
const listeners = new Set<() => void>();

function subscribeToHash(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("hashchange", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("hashchange", listener);
  };
}

function writeView(next: ViewState) {
  // replaceState, not pushState: picking a run should not fill the back button.
  // It also fires no hashchange, so subscribers are told by hand.
  window.history.replaceState(null, "", viewHash(next) || window.location.pathname);
  for (const listener of listeners) listener();
}

/**
 * The hour the mountain opens at, resolved once per resort.
 *
 * Cached at module level like the WebGL probe in `terrain-viewer.tsx`, and for
 * the same two reasons: `useSyncExternalStore` compares snapshots, so this has
 * to answer with the same string every time it is asked, and the server has no
 * clock to read — answering with one there would be a hydration mismatch.
 */
const opened = new Map<string, WallClock>();

function openedAt(resort: Resort): WallClock {
  const cached = opened.get(resort.slug);
  if (cached !== undefined) return cached;

  const hour = openingWallClock(resort);
  opened.set(resort.slug, hour);
  return hour;
}

/** Nothing to subscribe to — the hour the page opened at does not change. */
const noop = () => () => {};

export function RunExplorer({
  resort,
  runs,
  children,
}: {
  resort: Resort;
  runs: Run[];
  children: ReactNode;
}) {
  const [filter, setFilter] = useState<RunFilter>(NO_FILTER);
  const [sortKey, setSortKey] = useState<SortKey>("vertical_m");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [hovered, setHovered] = useState<string | null>(null);
  // Starts open, so the list is in the prerendered HTML and is what a visit
  // without JavaScript gets (SPEC §9). Collapsing only ever hides it.
  const [listOpen, setListOpen] = useState(true);
  const hash = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash,
    () => "",
  );
  const view = useMemo(() => parseViewHash(hash), [hash]);
  const selectedId = view.runId;
  const selectRun = (id: string | null) => writeView({ ...view, runId: id });

  // Null through the server render and the hydration pass, which is what the
  // control renders its dashes for — the same shape as the conditions strip.
  const openingHour = useSyncExternalStore(
    noop,
    () => openedAt(resort),
    () => null,
  );
  const sun = view.sun ?? openingHour;
  const sunAt = useMemo(
    () => (sun === null ? null : instantAt(sun, resort.timezone)),
    [resort.timezone, sun],
  );

  const visible = useMemo(
    () => sortRuns(filterRuns(runs, filter), sortKey, sortDirection),
    [runs, filter, sortKey, sortDirection],
  );
  const visibleIds = useMemo(() => new Set(visible.map((run) => run.id)), [visible]);
  // Read through the filter, so a run the filter has hidden is not still being
  // described by the panel and highlighted nowhere. The hash is left alone:
  // clearing it would break a shared link the moment a filter was touched.
  const selected =
    selectedId !== null && visibleIds.has(selectedId)
      ? (runs.find((run) => run.id === selectedId) ?? null)
      : null;
  // Read through the filter for the same reason `selected` is: a run the filter
  // has just hidden must not still be lit on a mountain it is no longer on.
  const hoveredId = hovered !== null && visibleIds.has(hovered) ? hovered : null;
  const maxVerticalM = useMemo(() => Math.max(50, ...runs.map((run) => run.vertical_m)), [runs]);

  function sortBy(key: SortKey) {
    if (key === sortKey) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(key);
    setSortDirection(DESCENDING_FIRST.includes(key) ? "desc" : "asc");
  }

  return (
    // The map holds still and the list scrolls past it. A pane with its own
    // scroller put a second scrollbar down the middle of the page and cost the
    // table the width of it; sticky spends one scrollbar on the whole page and
    // leaves the footer where it has always been, at the end.
    <div
      className={`xl:grid xl:items-start ${
        listOpen
          ? "xl:grid-cols-[minmax(0,1fr)_40rem] 2xl:grid-cols-[minmax(0,1fr)_44rem]"
          : "xl:grid-cols-[minmax(0,1fr)]"
      }`}
    >
      <section className="relative border-b border-line bg-shadow xl:sticky xl:top-0 xl:h-svh xl:border-r xl:border-b-0">
        <div className="h-[70svh] min-h-105 xl:h-full">
          <TerrainViewer
            overlay={{
              runs,
              visibleIds,
              selectedId: selected?.id ?? null,
              hoveredId,
              onSelect: selectRun,
              onHover: setHovered,
            }}
            resort={resort}
            sunAt={sunAt}
          />
        </div>
        {/* The header is all that is left over the terrain, and it sits on the
            sky rather than on the mountain. */}
        {children}

        {/* Folded away, the list still has to say what the mountain is showing:
            a run picked on the terrain has nowhere else to report itself. */}
        <div className="pointer-events-none absolute top-0 right-0 hidden p-5 xl:block">
          <button
            aria-controls="run-list"
            aria-expanded={listOpen}
            className="u-data pointer-events-auto flex max-w-64 cursor-pointer items-center gap-2 rounded border border-line bg-surface/90 px-3 py-2 text-rock shadow-panel backdrop-blur-sm transition-colors hover:border-rock-dim hover:text-snow"
            onClick={() => setListOpen(!listOpen)}
            type="button"
          >
            <span aria-hidden="true">{listOpen ? "→" : "←"}</span>
            <span className="truncate">
              {listOpen ? "Hide runs" : (selected && runCells(selected).name) || "Show runs"}
            </span>
          </button>
        </div>
      </section>

      {/* Hidden, never unmounted: without WebGL this table is the site, and the
          rows have to stay in the document for it to be (SPEC §9). */}
      <section className={listOpen ? undefined : "hidden"} id="run-list">
        {/* Stays put while the list moves under it, so the search box and the
            run being read are both still there 160 rows down. */}
        <div className="border-b border-line bg-shadow px-5 py-4 xl:sticky xl:top-0 xl:z-20">
          <RunFilters
            maxVerticalM={maxVerticalM}
            onChange={setFilter}
            shown={visible.length}
            total={runs.length}
            value={filter}
          />
          <SunControl
            onChange={(next) => writeView({ ...view, sun: next })}
            pinned={view.sun !== null}
            resort={resort}
            value={sun}
          />
          <RunPanel onClear={() => selectRun(null)} run={selected} />
        </div>

        <div className="px-5 pb-10">
          <RunTable
            hoveredId={hoveredId}
            onHover={setHovered}
            onSelect={(id) => selectRun(id === selected?.id ? null : id)}
            onSort={sortBy}
            runs={visible}
            selectedId={selected?.id ?? null}
            sortDirection={sortDirection}
            sortKey={sortKey}
          />
        </div>
      </section>
    </div>
  );
}
