"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { GradeFilter } from "@/components/grade-filter";
import { LiftTable } from "@/components/lift-table";
import { MapAttribution } from "@/components/map-attribution";
import { MapChrome } from "@/components/map-chrome";
import { PlaceList } from "@/components/place-list";
import { type Fact, ResortIdentity } from "@/components/resort-identity";
import { RunDetailCard } from "@/components/run-detail-card";
import { RunDrawer } from "@/components/run-drawer";
import { RunFilters } from "@/components/run-filters";
import { RunTable } from "@/components/run-table";
import { SiteFooter } from "@/components/site-footer";
import { SunControl, SunTimes } from "@/components/sun-control";
import { TerrainViewer } from "@/components/terrain-viewer";
import { type Inset, NO_INSET, chromeInset, sameInset } from "@/lib/inset";
import { type Rect, sameRects } from "@/lib/label-layout";
import {
  NO_FILTER,
  type RunFilter,
  type SortDirection,
  type SortKey,
  filterRuns,
  sortRuns,
} from "@/lib/run-list";
import { type WallClock, instantAt, openingWallClock } from "@/lib/sun";
import type { Lift, Place, Resort, Run } from "@/lib/types";
import { type ViewState, parseViewHash, viewHash } from "@/lib/view-hash";
import { hasWebGL } from "@/lib/webgl";

/**
 * One filter and one selection, driving the mountain and the table together.
 *
 * The state lives here because SPEC §9 requires both views to answer to the
 * same filters. Everything below is presentational, and the logic it needs is
 * in `lib/run-list.ts` where it can be tested without a DOM.
 *
 * The mountain is the page. It fills the window; the list is a drawer over its
 * right edge, and the controls that change what the terrain shows — the hour of
 * the sun, the grades standing — sit on the terrain with it. What is left in
 * the drawer is what you read rather than what you steer.
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
 * Cached at module level like the WebGL probe in `lib/webgl.ts`, and for the
 * same two reasons: `useSyncExternalStore` compares snapshots, so this has to
 * answer with the same string every time it is asked, and the server has no
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

/** Nothing to subscribe to — neither the opening hour nor WebGL support changes. */
const noop = () => () => {};

/** Tailwind's `xl`, which is where the drawer stops being a sheet and docks. */
const DOCKED = "(min-width: 80rem)";

export function RunExplorer({
  facts,
  lifts,
  places,
  resort,
  runs,
}: {
  facts: Fact[];
  lifts: Lift[];
  places: Place[];
  resort: Resort;
  runs: Run[];
}) {
  const [filter, setFilter] = useState<RunFilter>(NO_FILTER);
  // Lifts and places answer to hover and to nothing else. They are not
  // selectable, not filtered and not in the URL: a cable is drawn where it runs
  // and reads from the opening framing, so there is no state a reader could
  // want back later. Pointing at one is the whole interaction.
  const [hoveredLiftId, setHoveredLiftId] = useState<string | null>(null);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("vertical_m");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [hovered, setHovered] = useState<string | null>(null);
  // Starts open, so the list is in the prerendered HTML and is what a visit
  // without JavaScript gets (SPEC §9). Collapsing only ever hides it.
  const [drawerOpen, setDrawerOpen] = useState(true);
  // Lives beside the button that presses it. A counter rather than a flag:
  // pressing reset twice has to fly twice, and the scene reports no arrival.
  const [resetSignal, setResetSignal] = useState(0);
  const drawer = useRef<HTMLElement>(null);
  const masthead = useRef<HTMLDivElement>(null);
  const [inset, setInset] = useState<Inset>(NO_INSET);
  const [chrome, setChrome] = useState<Rect[]>([]);
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

  // Asked here rather than in the viewer because the answer decides the layout
  // as well as the canvas: without a GPU the table is the site (SPEC §9).
  const webgl = useSyncExternalStore(noop, hasWebGL, () => null);
  // The sun and the grades belong on the mountain, which is what they change.
  // With no mountain to change they fall back into the drawer rather than
  // floating over a paragraph explaining why there isn't one.
  const steerOnMap = webgl !== false;
  // Forced out when the terrain cannot be drawn: the table is then the site,
  // and a collapsed drawer would leave a browser with no GPU an empty window.
  const listOpen = drawerOpen || !steerOnMap;

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
  // described by the card and highlighted nowhere. The hash is left alone:
  // clearing it would break a shared link the moment a filter was touched.
  const selected =
    selectedId !== null && visibleIds.has(selectedId)
      ? (runs.find((run) => run.id === selectedId) ?? null)
      : null;
  // Read through the filter for the same reason `selected` is: a run the filter
  // has just hidden must not still be lit on a mountain it is no longer on.
  const hoveredId = hovered !== null && visibleIds.has(hovered) ? hovered : null;
  const maxVerticalM = useMemo(() => Math.max(50, ...runs.map((run) => run.vertical_m)), [runs]);

  // Held so the label pass can be told to run again by the array changing, and
  // only by that: measured every render, it would otherwise hand the pass a new
  // array each time and the two would chase each other.
  const onMeasure = useCallback(
    (next: Rect[]) => setChrome((held) => (sameRects(held, next) ? held : next)),
    [],
  );

  /**
   * What the chrome is standing on, so the scene can compose the mountain into
   * the rest of the window. Each box is measured rather than mirrored from the
   * classes that set it; which edge that lands on is `lib/inset.ts`.
   *
   * The masthead is watched rather than read once: it reflows with the window,
   * and the facts row wraps to two lines before the drawer does anything.
   */
  useEffect(() => {
    const dock = window.matchMedia(DOCKED);

    const measure = () => {
      const panel = drawer.current;
      const next = chromeInset({
        docked: dock.matches,
        drawerHeight: panel?.offsetHeight ?? 0,
        drawerWidth: panel?.offsetWidth ?? 0,
        mastheadHeight: masthead.current?.offsetHeight ?? 0,
        open: listOpen,
      });
      setInset((held) => (sameInset(held, next) ? held : next));
    };

    measure();
    const watching = new ResizeObserver(measure);
    if (masthead.current !== null) watching.observe(masthead.current);
    dock.addEventListener("change", measure);
    window.addEventListener("resize", measure);
    return () => {
      watching.disconnect();
      dock.removeEventListener("change", measure);
      window.removeEventListener("resize", measure);
    };
  }, [listOpen]);

  /**
   * A run picked on the terrain has a row, and until now it was a hundred and
   * forty deep in an unscrolled list. `nearest` makes this free the other way
   * round: picked from the table, the row is already in view and nothing moves.
   */
  useEffect(() => {
    if (selectedId === null) return;
    drawer.current
      ?.querySelector(`[data-run="${CSS.escape(selectedId)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  function sortBy(key: SortKey) {
    if (key === sortKey) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      return;
    }
    setSortKey(key);
    setSortDirection(DESCENDING_FIRST.includes(key) ? "desc" : "asc");
  }

  const sunControl = (
    <SunControl
      onChange={(next) => writeView({ ...view, sun: next })}
      pinned={view.sun !== null}
      resort={resort}
      value={sun}
    />
  );

  // Marks alone on the mountain, which is what teaches them; words in the
  // drawer, which is where it goes when there is no mountain. The two are
  // mutually exclusive, so `steerOnMap` decides it and one node covers both.
  const gradeFilter = <GradeFilter compact={steerOnMap} onChange={setFilter} value={filter} />;

  // The live copy of this number. The drawer's filters print it too and do not
  // announce it, so a reader is not told twice.
  const runCount = (
    <p aria-live="polite" className="u-data">
      {visible.length === runs.length
        ? `${runs.length} marked runs`
        : `${visible.length} of ${runs.length} shown`}
    </p>
  );

  // Veiled on the terrain, bare in the drawer.
  const detailCard = (veiled: boolean) =>
    selected && <RunDetailCard onClear={() => selectRun(null)} run={selected} veiled={veiled} />;

  return (
    <div className="relative h-svh overflow-hidden bg-shadow">
      {/* First focusable thing on the page. The map's controls are a dozen
          stops on the way to the numbers, and the drawer they lead to may be
          shut — so this opens it as well as going there. */}
      <button
        // Parked off the top of the frame rather than in `sr-only`, whose
        // `not-sr-only` counterpart resets the padding back off again.
        className="u-panel u-data absolute top-5 left-5 z-40 -translate-y-24 px-3 py-2 text-snow focus:translate-y-0"
        onClick={() => {
          setDrawerOpen(true);
          drawer.current?.focus();
        }}
        type="button"
      >
        Skip to the run table
      </button>

      <div className="absolute inset-0">
        <TerrainViewer
          inset={inset}
          mountain={{
            lifts,
            places,
            hoveredLiftId,
            hoveredPlaceId,
            onHoverLift: setHoveredLiftId,
            onHoverPlace: setHoveredPlaceId,
            reserved: chrome,
          }}
          overlay={{
            runs,
            visibleIds,
            selectedId: selected?.id ?? null,
            hoveredId,
            onSelect: selectRun,
            onHover: setHovered,
          }}
          resetSignal={resetSignal}
          resort={resort}
          sunAt={sunAt}
          webgl={webgl}
        />
      </div>

      <MapChrome
        disclaimer={<MapAttribution />}
        instruments={
          steerOnMap && (
            // Three clusters that each take the pointer on their own. The row
            // between and around them does not: a band across the foot of the
            // window that swallowed a drag would be the bottom of the mountain
            // gone. The sun holds the flexible middle, so it is what drops to
            // its own line first when the window is too narrow for one row.
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="pointer-events-auto min-w-72 flex-1">{sunControl}</div>

              <div className="pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-2">
                {gradeFilter}
                {runCount}
              </div>

              {/* The way back to the whole mountain, and conditional on
                  nothing: the viewer this exists for has orbited into a corner
                  of the mosaic and has not necessarily picked a run to clear.
                  Outside the aria-hidden canvas, so it is still reachable by
                  keyboard. */}
              <button
                className="u-data pointer-events-auto flex shrink-0 cursor-pointer items-center gap-2 rounded border border-rock-dim bg-surface px-2.5 py-1.5 text-snow transition-colors hover:border-rock hover:bg-surface-high"
                onClick={() => setResetSignal((presses) => presses + 1)}
                type="button"
              >
                <span aria-hidden="true">↺</span>
                Reset view
              </button>
            </div>
          )
        }
        listOpen={listOpen}
        masthead={
          <div ref={masthead}>
            <ResortIdentity facts={facts} resort={resort} />
          </div>
        }
        onMeasure={onMeasure}
        selection={
          // Under the masthead, continuing one column from the range to the
          // feature to the readout. Narrow windows read it at the head of the
          // drawer instead, beside the table it came from.
          steerOnMap && <div className="hidden xl:block">{detailCard(true)}</div>
        }
      />

      <RunDrawer
        collapsible={steerOnMap}
        head={
          <>
            <RunFilters
              announce={!steerOnMap}
              maxVerticalM={maxVerticalM}
              onChange={setFilter}
              shown={visible.length}
              total={runs.length}
              value={filter}
            />

            {/* Sunrise and sunset stand here whether or not there is a
                mountain to draw them on. They came off the instrument strip
                because they are facts about the place rather than about the
                render, and without a GPU this list is the site — so the one
                copy has to be the one that is always rendered (SPEC §9). */}
            <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
              {!steerOnMap && sunControl}
              <SunTimes resort={resort} value={sun} />
              {!steerOnMap && gradeFilter}
            </div>

            {selected === null ? (
              <p className="mt-2.5 text-sm text-rock-dim">
                Select a run, here or on the mountain, to see its measurements.
              </p>
            ) : (
              <div className={steerOnMap ? "mt-3 xl:hidden" : "mt-3"}>{detailCard(false)}</div>
            )}
          </>
        }
        onToggle={() => setDrawerOpen(!drawerOpen)}
        open={listOpen}
        ref={drawer}
      >
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

        {/* Below the runs, and headed, because a hundred and sixty-eight rows
            above it is otherwise no signal that the subject has changed. */}
        {lifts.length > 0 && (
          <section className="mt-12">
            <h2 className="u-massif text-sm text-snow">Lifts</h2>
            <p className="mt-1.5 mb-3 text-xs text-rock">
              Every lift on the mountain. The run filters above do not apply here.
            </p>
            <LiftTable hoveredId={hoveredLiftId} lifts={lifts} onHover={setHoveredLiftId} />
          </section>
        )}

        {places.length > 0 && (
          <section className="mt-10">
            <h2 className="u-massif text-sm text-snow">On the mountain</h2>
            <p className="mt-1.5 mb-1 text-xs text-rock">
              Places OpenStreetMap names inside the ski area.
            </p>
            <PlaceList hoveredId={hoveredPlaceId} onHover={setHoveredPlaceId} places={places} />
          </section>
        )}

        {/* The long form of what the map's own line says. It lives at the foot
            of the list because the window no longer scrolls past the mountain
            to reach a page footer (SPEC §8). */}
        <div className="-mx-5 mt-10">
          <SiteFooter />
        </div>
      </RunDrawer>
    </div>
  );
}
