"use client";

import { type ReactNode, useMemo, useState, useSyncExternalStore } from "react";
import { RunFilters } from "@/components/run-filters";
import { RunPanel } from "@/components/run-panel";
import { RunTable } from "@/components/run-table";
import { TerrainViewer } from "@/components/terrain-viewer";
import {
  NO_FILTER,
  type RunFilter,
  type SortDirection,
  type SortKey,
  filterRuns,
  sortRuns,
} from "@/lib/run-list";
import type { Resort, Run } from "@/lib/types";

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
 * The selected run lives in the URL, so a view can be sent to someone.
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

function selectRun(id: string | null) {
  // replaceState, not pushState: picking a run should not fill the back button.
  // It also fires no hashchange, so subscribers are told by hand.
  window.history.replaceState(null, "", id ? `#run=${id}` : window.location.pathname);
  for (const listener of listeners) listener();
}

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
  const hash = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash,
    () => "",
  );
  // An id naming no run — a stale link, a typo — simply selects nothing.
  const selectedId = hash.match(/^#run=(.+)$/)?.[1] ?? null;

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
    <>
      <section className="relative border-b border-line bg-shadow">
        <TerrainViewer
          overlay={{ runs, visibleIds, selectedId: selected?.id ?? null, onSelect: selectRun }}
          resort={resort}
        />
        {children}

        {/* Over the terrain on a wide screen, below it on a narrow one — the
            same markup either way, so neither view has a second copy of the
            filter controls to keep in step. */}
        <div className="pointer-events-none relative md:absolute md:inset-0">
          <div className="mx-auto flex h-full max-w-5xl flex-col gap-4 px-6 pb-8 md:flex-row md:items-stretch md:justify-between md:pt-52">
            <div className="pointer-events-auto md:self-start">
              <RunFilters maxVerticalM={maxVerticalM} onChange={setFilter} value={filter} />
            </div>
            <div className="pointer-events-auto md:self-end">
              <RunPanel run={selected} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="u-data">
          {runs.length} marked runs
          {visible.length !== runs.length && ` · ${visible.length} shown`}
        </h2>

        <RunTable
          onSelect={(id) => selectRun(id === selected?.id ? null : id)}
          onSort={sortBy}
          runs={visible}
          selectedId={selected?.id ?? null}
          sortDirection={sortDirection}
          sortKey={sortKey}
        />
      </section>
    </>
  );
}
