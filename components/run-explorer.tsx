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
import { type Inset, NO_INSET, chromeInset, drawerOpen, sameInset } from "@/lib/inset";
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
 * One filter and one selection, driving the mountain and the table together. The state
 * lives here because SPEC §9 requires both views to answer the same filters. Everything
 * below is presentational, and the logic is in `lib/run-list.ts`, testable without a DOM.
 */

/** Numeric columns open biggest-first; names and grades open at the top. */
const DESCENDING_FIRST: SortKey[] = ["vertical_m", "length_m", "pitch_avg_deg", "pitch_max_deg"];

/**
 * The selected run and the hour the sun is drawn at live in the URL, so a view can be sent
 * to someone. Read through `useSyncExternalStore` rather than an effect: the server has no
 * location, and `useSearchParams` would take this subtree out of the prerendered HTML.
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
  // replaceState so picking a run does not fill the back button; it fires no hashchange.
  window.history.replaceState(null, "", viewHash(next) || window.location.pathname);
  for (const listener of listeners) listener();
}

/**
 * The hour the mountain opens at, resolved once per resort. Cached at module level because
 * `useSyncExternalStore` compares snapshots, so this has to answer with the same string
 * every time, and because a server with no clock answering one would be a mismatch.
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

/**
 * The `handheld` variant in `app/globals.css`, which has to say the same thing
 * in both places: the masthead folds and the sheet opens peeked together.
 */
const HANDHELD = "(max-width: 47.9375rem), (max-height: 30rem) and (max-width: 79.9375rem)";

/**
 * A media query as a store. The server has no window to measure, so it answers no, which
 * keeps the prerendered HTML the wide one. One list, held: `get` is read on every render
 * and again after every commit.
 */
function mediaStore(query: string) {
  let list: MediaQueryList | null = null;
  const watched = () => (list ??= window.matchMedia(query));

  return {
    subscribe: (onChange: () => void) => {
      const watching = watched();
      watching.addEventListener("change", onChange);
      return () => watching.removeEventListener("change", onChange);
    },
    get: () => watched().matches,
    server: () => false,
  };
}

const handheldStore = mediaStore(HANDHELD);

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
  // Lifts and places answer to hover alone: not selectable, not filtered, not in the URL.
  const [hoveredLiftId, setHoveredLiftId] = useState<string | null>(null);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("vertical_m");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [hovered, setHovered] = useState<string | null>(null);
  // Null until the reader says; the default is the window's rather than a constant.
  const [drawerChoice, setDrawerChoice] = useState<boolean | null>(null);
  // Six facts and four readings are a third of a phone's window. Folded there alone.
  const [factsOpen, setFactsOpen] = useState(false);
  // A counter rather than a flag: pressing reset twice has to fly twice.
  const [resetSignal, setResetSignal] = useState(0);
  const drawer = useRef<HTMLElement>(null);
  const masthead = useRef<HTMLDivElement>(null);
  const [inset, setInset] = useState<Inset>(NO_INSET);
  const [chrome, setChrome] = useState<Rect[]>([]);
  const [covered, setCovered] = useState<Rect[]>([]);
  const hash = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash,
    () => "",
  );
  const view = useMemo(() => parseViewHash(hash), [hash]);
  const selectedId = view.runId;
  const selectRun = (id: string | null) => writeView({ ...view, runId: id });

  // Null through the server render and hydration, which is what the control dashes for.
  const openingHour = useSyncExternalStore(
    noop,
    () => openedAt(resort),
    () => null,
  );

  // Asked here, not in the viewer: without a GPU the table is the site (SPEC §9).
  const webgl = useSyncExternalStore(noop, hasWebGL, () => null);
  // The sun and grades belong on the mountain; with no mountain they fall to the drawer.
  const steerOnMap = webgl !== false;
  const phone = useSyncExternalStore(
    handheldStore.subscribe,
    handheldStore.get,
    handheldStore.server,
  );
  const listOpen = drawerOpen({ choice: drawerChoice, phone, steerOnMap });
  // The facts are the page without a GPU, so they are never folded away there.
  const factsShown = factsOpen || !steerOnMap;

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
  // Read through the filter; the hash is left alone, or a filter would break a shared link.
  const selected =
    selectedId !== null && visibleIds.has(selectedId)
      ? (runs.find((run) => run.id === selectedId) ?? null)
      : null;
  // Read through the filter too: a hidden run must not still be lit on the mountain.
  const hoveredId = hovered !== null && visibleIds.has(hovered) ? hovered : null;
  const maxVerticalM = useMemo(() => Math.max(50, ...runs.map((run) => run.vertical_m)), [runs]);

  // Held so the label pass is told by the array changing, and only by that.
  const onMeasure = useCallback(
    (next: Rect[]) => setChrome((held) => (sameRects(held, next) ? held : next)),
    [],
  );

  /**
   * The sheet is a sibling of the frame that measures the chrome clusters, so the band it
   * covers is reserved here instead. Read on arrival: it slides for the length of its
   * transition and renders nothing on the way, so a rect taken at the start is the old one.
   */
  useEffect(() => {
    const panel = drawer.current;
    if (panel === null) return;

    const measure = () => {
      const { x, y, width, height } = panel.getBoundingClientRect();
      const next = width > 0 && height > 0 ? [{ x, y, width, height }] : [];
      setCovered((held) => (sameRects(held, next) ? held : next));
    };

    measure();
    panel.addEventListener("transitionend", measure);
    window.addEventListener("resize", measure);
    return () => {
      panel.removeEventListener("transitionend", measure);
      window.removeEventListener("resize", measure);
    };
  }, [listOpen]);

  const reserved = useMemo(() => [...chrome, ...covered], [chrome, covered]);

  /**
   * What the chrome is standing on, so the scene can compose the mountain into the rest of
   * the window. Each box is measured rather than mirrored from the classes that set it.
   * The masthead is watched rather than read once, because it reflows with the window.
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
      compact={steerOnMap}
      onChange={(next) => writeView({ ...view, sun: next })}
      pinned={view.sun !== null}
      resort={resort}
      value={sun}
    />
  );

  // Marks alone on the mountain, which teaches them; words in the drawer, where nothing does.
  const gradeFilter = <GradeFilter compact={steerOnMap} onChange={setFilter} value={filter} />;

  // The live copy; the drawer's filters print it too and do not announce it.
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
        // Parked off the top of the frame, not `sr-only`: `not-sr-only` resets the padding.
        className="u-panel u-data absolute top-5 left-5 z-40 -translate-y-24 px-3 py-2 text-snow focus:translate-y-0"
        onClick={() => {
          setDrawerChoice(true);
          drawer.current?.focus();
        }}
        type="button"
      >
        Skip to the run table
      </button>

      <div className="absolute inset-0">
        <TerrainViewer
          handheld={phone}
          inset={inset}
          mountain={{
            lifts,
            places,
            hoveredLiftId,
            hoveredPlaceId,
            onHoverLift: setHoveredLiftId,
            onHoverPlace: setHoveredPlaceId,
            reserved,
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
            // Clusters take the pointer; the row does not, or a drag at the foot is eaten.
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 handheld:gap-x-3 handheld:gap-y-2">
              <div className="pointer-events-auto min-w-72 flex-1 handheld:min-w-min">
                {sunControl}
              </div>

              <div className="pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-2">
                {gradeFilter}
                {runCount}
              </div>

              {/* The way back to the whole mountain, conditional on nothing: this
                  viewer has orbited into a corner and need not have picked a run.
                  Outside the aria-hidden canvas, so a keyboard can still reach it. */}
              <button
                aria-label="Reset view"
                className="u-data pointer-events-auto flex shrink-0 cursor-pointer items-center gap-2 rounded border border-rock-dim bg-surface px-2.5 py-1.5 text-snow transition-colors hover:border-rock hover:bg-surface-high"
                onClick={() => setResetSignal((presses) => presses + 1)}
                type="button"
              >
                <span aria-hidden="true">↺</span>
                {/* The glyph carries it where the row has no width for a word;
                    `aria-label` is the name either way, so it does not change. */}
                <span className="handheld:hidden">Reset view</span>
              </button>
            </div>
          )
        }
        listOpen={listOpen}
        masthead={
          <div ref={masthead}>
            <ResortIdentity
              collapsible={steerOnMap}
              facts={facts}
              factsShown={factsShown}
              onToggleFacts={() => setFactsOpen(!factsOpen)}
              resort={resort}
            />
          </div>
        }
        onMeasure={onMeasure}
        selection={
          // Under the masthead; narrow windows read it at the head of the drawer instead.
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

            {/* Sunrise and sunset stand here whether or not there is a mountain to
                draw them on: they are facts about the place rather than the render,
                and without a GPU this list is the site, so this copy always renders. */}
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
        onToggle={() => setDrawerChoice(!listOpen)}
        open={listOpen}
        ref={drawer}
        untouched={drawerChoice === null}
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
