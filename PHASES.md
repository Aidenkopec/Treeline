# Treeline — phases

Progress tracker for [SPEC.md](./SPEC.md) §11. Each phase ends working, committed and
deployable, and runs in its own session with its own verification gate.

**Status: phase 4 done. Phase 5 next.** Lake Louise's 168 runs are drawn on the terrain
coloured by difficulty, with search, filters, a per-run stats panel, an inline SVG elevation
profile and the sortable HTML table, laid out as a map beside a list. Picking a run flies the
camera to it, and Reset view always brings the whole mountain back. Today's snow, temperature
and wind read live from Open-Meteo under the resort facts, on the mountain's own clock.
212 tests green.

> **Next action:** phase 5 — sun/shade from `suncalc` and the first-person run camera.
> `suncalc` and `@types/suncalc` are already installed and unused; `Resort.lat`/`lon` and
> each run's `profile` samples carry lon, lat and elevation, so both halves have their input
> baked already. Gate: a known sunrise/sunset asserted for a fixed date and latitude, and a
> camera path that stays on the polyline within tolerance.

---

## Phase 0 — Foundation ✅ done

Not in SPEC §11. Added because §11 assumes a project already exists, and the work of
creating one needed a label.

- [x] Next.js 16 + React 19 + TypeScript + Tailwind v4, App Router, no `src/`
- [x] Design token system (`app/globals.css`) — Imhof relief palette, Archivo width scale
- [x] `lib/types.ts` — the build-time↔runtime data contract, every SPEC §6 field typed
- [x] Difficulty marks by shape, not color alone (`components/difficulty-mark.tsx`)
- [x] SPEC §8 disclaimer, inbounds framing and attribution in the root layout
- [x] Resort index page with an honest "not baked" empty state
- [x] Masthead figure — one massif in section, treeline labelled, a lift up and a run
      down it, drawn once on load in CSS alone (no client component)
- [x] `resorts.json` — all six resorts configured
- [x] vitest + tsx wired; `npm test`, `npm run typecheck`, `npm run lint`, `npm run bake`
- [x] Formatting and hygiene — Prettier, lint-staged pre-commit, agent hooks, CI gate
- [x] Route handler skeletons for conditions (phase 4) and OG images (phase 8)
- [x] AGENTS.md records the §8 rules as non-negotiable in an implementation session

**Verified:** build passes, lint and typecheck clean, 48 tests green, no console errors,
no layout overflow from 320px up.

---

## Phase 1 — Bake pipeline, Lake Louise only ✅ done

**Deliverable:** real artifacts for one resort — `heightmap.png`, `satellite.jpg`,
`runs.json`, manifest entry.

**Gate (SPEC §11):**

- [x] Downhill-only filter asserted against a fixture containing backcountry ways
- [x] Fixture tile decodes to known elevations — real tile `13/1452/2726`; the base area
      reads within 20m of the published 1646m
- [x] Golden pitch/aspect for two hand-checked Lake Louise runs, within tolerance —
      Wiwaxy and Eagles Flight, checked against Copernicus DEM GLO-90

### Done

- [x] `tiles.ts` — Web Mercator tile math, 8/8 functions, 8 tests (SPEC §13's hard part)
- [x] `terrarium.ts` — elevation decode, 3/3 functions, 7 tests
- [x] `terrain.ts` — Horn's method slope/aspect + bilinear sampling, 5/5 functions, 12 tests
- [x] `overpass.ts` — query builders and the `piste:type=downhill` safety filter, 11 tests

### Remaining, in order

**1. Derived stats** — `scripts/bake/runs.ts` ✅ done. Pure math, no network:

- [x] `sampleProfile` — resample a polyline to a fixed ground interval against the DEM
- [x] `averagePitch` — mean slope, weighted by segment length
- [x] `sustainedMaxPitch` — sliding window, so one noisy DEM cell can't report a cliff
- [x] `meanAspect` — averaged as unit vectors, not raw degrees (350° and 10° average to N, not S)
- [x] `deriveRun` — assemble one complete `Run`

**2. Network and raster I/O** ✅ done:

- [x] `overpass.ts` `runQuery` — POST, with retry and backoff on 429/502/503/504
- [x] Tile download + stitch via `sharp` (elevation and imagery share `tiles.ts`)
- [x] `imagery.ts` `bakeSatelliteTexture` — two zoom levels deeper than the DEM

**3. Emit** — `scripts/bake/emit.ts` ✅ done:

- [x] RGB-encoded `heightmap.png`, `satellite.jpg`, `runs.json`, manifest update
- [x] `reportAssetWeight` against the SPEC §10 budget

**4. Orchestrate** — `scripts/bake.ts` ✅ done: `bakeResort`, `checkResort`, `--no-cache`

**5. Close the gate** ✅ done:

- [x] Bake Lake Louise for real; commit the artifacts — 1.97 MB of the 5 MB budget
- [x] Verify against independent sources, not the pipeline's own output
- [x] Commit golden values and structural invariants in `tests/runs.golden.test.ts`

**Verified:** 102 tests green, format/lint/typecheck/build clean, home page shows Lake
Louise as baked. Elevation checked two ways — seven OSM surveyed peaks and lift stations
(every sharp summit reads low, mean -43m; the valley floor reads +6m high; a broad rounded
hill reads exact, which is resampling ~30m data rather than a bug), and two runs against
Copernicus DEM GLO-90 (pitch within 0.3° on Eagles Flight, 3.5° on the much shallower
Wiwaxy, where DEM noise dominates a gentle gradient).

**Known, accepted:** one run per OSM way means a name can appear more than once, and a
famous published figure may describe a different object than the way carrying its name —
the FIS Men's Downhill _course_ is 3123m/827m over several trails, while the OSM way named
"Men's Downhill" is the 743m/256m pitch itself. Revisit in phase 3 with the list on screen.

---

## Phase 2 — Next.js app renders that terrain ✅ done

**Deliverable:** `/resorts/[slug]`, statically generated from the manifest, drawing the
baked heightmap as terrain with the satellite imagery draped over it.

- [x] `lib/elevation.ts` — the RGB elevation decode, moved out of `scripts/bake/` so the
      bake and the app share one implementation of the encoding rather than two
- [x] `metres_per_pixel` in the manifest — the bake already computed it, it just never
      reached the artifact, and without it the mesh has no real-world scale
- [x] `lib/terrain-mesh.ts` — heightmap to vertices in metres, 7 tests including an
      encode→PNG→decode→mesh round trip across the build/runtime boundary
- [x] `components/terrain-scene.tsx` — R3F canvas, satellite material, Imhof sun/shade
      lighting, orbit controls that auto-rotate until grabbed
- [x] `components/terrain-viewer.tsx` — WebGL probe and the fallback when there is none
- [x] Vertical exaggeration tuned by eye: 1.4 → **1.8** for Lake Louise

**Verified:** 60fps locked at 2850x1150 (p95 17.2ms, worst frame 17.7ms) on a 393k-vertex,
784k-triangle mesh, so no decimation was needed. Terrain is recognisably Lake Louise —
Whitehorn's summit ridge, the Front Side runs, the base area and the lake all land where
they belong, with the imagery registered to the landform. Console clean. Without WebGL the
page still carries name, country, elevation range, run count, vertical scale, baked date
and the disclaimer, all in the server HTML — no JS required to read any of it.

**Known, accepted:** the mesh is a rectangle with hard cut edges rather than a plinth with
a skirt; at phone widths the terrain fits the frame but sits small, which is inside SPEC
§3's "must not be broken on a phone, is not designed for one". `@react-three/fiber` logs
one `THREE.Clock is deprecated` warning from its own internals.

**Hardened after review:**

- A failed artifact fetch degrades to the same notice as the no-GPU path instead of
  reaching Next's root error boundary and taking the facts and the disclaimer down with
  it; the load moved out of the R3F tree so a plain error boundary can catch it, and a
  rejected load is no longer cached for the rest of the session
- The heightmap decodes through a detached canvas rather than `OffscreenCanvas`, which
  Safari shipped four versions after WebGL2 — the probe was waving through browsers that
  then crashed. The probe also releases its WebGL context instead of holding a slot
- The opening framing is frozen at first render, so a resize no longer recomputes the
  orbit clamps and drags a zoomed-out camera back in (`openingFraming`, 4 tests)
- A missing or malformed `runs.json` reads as `—`, not as the fact "0 marked runs"

## Phase 3 — Run overlay, stats panel, filters, elevation profile ✅ done

**Gate (SPEC §11):**

- [x] Stats in UI match `runs.json` — `runCells` asserted against the committed artifact
      rather than checked by eye (`tests/run-list.test.ts`)
- [x] Filter unit tests — boundaries, `[]` meaning "all", `[null]` meaning untagged
- [x] Profile renders from a fixture — a descent with corners known by construction,
      plus the degenerate cases (`tests/profile-path.test.ts`)

### Done

- [x] `lib/terrain-mesh.ts` — `lonLatToMesh` / `runMeshPoints`, the projection the phase-2
      UV comment was written anticipating. Longitude is linear in Mercator and latitude is
      not, so it goes through `mercatorY`; `bounds` sits on pixel _edges_ while vertices sit
      at pixel _centres_, and that half-pixel cancels against the recentre
- [x] `lib/run-list.ts` — filter, sort and the table's cells, pure and tested in node
- [x] `lib/profile-path.ts` — the profile as SVG path data, straight segments between
      samples because the corners are the data
- [x] `components/run-overlay.tsx` — one drei `<Line>` per run inside the R3F scene
- [x] `components/run-explorer.tsx` — one filter and one selection driving both views
- [x] `components/run-filters.tsx`, `run-panel.tsx`, `elevation-profile.tsx`, `run-table.tsx`
- [x] Selected run in `#run=<id>`, shareable, read through `useSyncExternalStore`

**No bake change and no re-bake:** every field phase 3 needed was already in `runs.json`,
including the full 25m resampled profile.

### Decisions worth recording

- **Advanced and expert are near-white** (`--color-diff-advanced` / `-expert`), which is
  right on a dark panel and invisible drawn over snow — and 105 of 168 runs are one of the
  two. Each run is drawn twice, a dark casing under a coloured core, the way a map keeps a
  road legible over any background. No palette change, no steepness ramp (SPEC §8).
- **The selected run is in the URL hash, not in `searchParams`.** `useSearchParams` would
  de-opt the route to client-side rendering up to the nearest Suspense boundary and take the
  table out of the prerendered HTML, undoing phase 2's no-JS guarantee. Verified: the built
  `lake-louise.html` carries all 168 rows, 75 KB gzipped, 1.78 MB of the 5 MB budget.
- **Filters stay in React state**, so they are deliberately not shareable.
- **The phase-1 question about same-named ways was reviewed with the list on screen and
  left as it is.** 168 OSM ways, one row each: 7 unnamed render as "Unnamed run", and the
  16 that share a name are told apart by their own numbers. Merging them into one run per
  named trail is bake math — stitching ways and recomputing pitch across the joins — and
  belongs in its own change, not in a UI phase.
- **Pitch prints whole degrees.** `runs.json` stores 7.3 and `lib/format.ts` rounds it, on
  the standing judgement that a 30m DEM does not support the decimal. So "stats match
  `runs.json`" means after that rounding, which is what the test asserts.

**Verified:** 143 tests green, format/lint/typecheck/build clean, console clean apart from
the `THREE.Clock` deprecation phase 2 already recorded. Checked in the browser: runs sit on
the landform and follow the trails visible in the imagery; white advanced/expert runs read
clearly against snow; filtering to Expert left 27 runs in both the table and the scene;
clicking a line on the mountain selected Headwall, and every figure in the panel matched its
row in `runs.json` (22°, 23°, SW 207°, 252m, 673m, profile 2583m→2331m); a cold reload of
`#run=883614835` restored that selection; sorting by average pitch put the Gullies and
E.R. 3 on top, which is the right answer for this mountain.

**Found and fixed during that pass** — none of these were things a test would have caught:

- The coloured cores beaded along their length: a wide casing and a narrow core on identical
  geometry z-fight, and the casing won in patches. The casing now draws first and writes no
  depth, so the core always lands on top while both still hide behind a ridge.
- The profile's axis labels were reversed. The profile descends left to right, so the left
  end is the top of the run; it was printing the bottom there. It also reprinted the length,
  which rounds a metre differently from the baked `length_m` — that is gone, since the panel
  prints length directly above the chart.
- A selected run stayed in the panel after a filter hid it from both views. `selected` is now
  read through the filter, so the panel empties while the run is hidden. The hash is left
  alone deliberately: clearing it would break a shared link the moment a filter was touched,
  and clearing the filter brings the selection straight back.
- Click-to-select uses R3F's own `onClick`, which already refuses to fire when the pointer
  moved more than two pixels, rather than a hand-rolled pointerdown/up comparison. The
  handler sits on the casing because it is the wider of the two lines and a two-pixel core is
  a hard thing to hit on a mountain.

**Known, accepted:** a run line is a small target at the opening camera distance — it is
easier to pick a run from the table, which is the accessible path anyway.

### Revised after a look at the built page

Phase 3's gate was about whether the numbers were right, and they were. Sat in front of it,
four things about it were not:

- **The filter card floated over the canvas** and covered the west face, which is where this
  mountain keeps most of its runs.
- **Selecting a run changed nothing you could see.** Selection was carried by line width
  alone, 2px to 4px. 105 of 168 runs are the same near-white; two pixels among them is not a
  signal. Zooming into a screenshot of a selected run, there was no way to tell which it was.
- **The map and the table never coexisted.** The map was 707px, the page 7070px, so a run
  picked six screens down was on a mountain that had long since scrolled away.
- **The camera framed the DEM mosaic rather than the runs.** The mosaic is cut to whole tiles:
  measured off the committed artifacts it is 9136m x 6086m, while the runs cover 4428m x
  4523m — 36% of it, sitting 490m west of centre. Half the canvas was ground with nothing
  drawn on it.

**Done**

- [x] `lib/terrain-mesh.ts` — `FocusExtent` / `runExtent`, and `openingFraming` takes an
      optional box to fit. Framed on the runs the camera comes in to under 60% of the mosaic
      distance, roughly doubling how big they read
- [x] `components/run-overlay.tsx` — a run that is not being looked at drops its casing and
      mixes towards the ground colour; the one that is draws after every other, at 5px
- [x] `components/run-explorer.tsx` — two panes at `xl:`, the map beside the list, stacking
      into the old single-column flow below it
- [x] `lib/run-list.ts` — `query` on `RunFilter` and `isFiltered`, both pure and tested
- [x] `components/run-filters.tsx` — search box, the chips and slider as a block beside the
      map rather than a card on top of it, and a live "N of 168 shown" with a clear button
- [x] `components/run-table.tsx` — every header carries a sort glyph, not just the sorted one
- [x] `hoveredId` alongside `selectedId`: hovering a row lights its run, and the run its row

**Decisions worth recording**

- **A run recedes by colour, not by opacity.** `Line2` draws a polyline as one quad per
  segment and consecutive quads overlap at the joins, so a blended line composites twice at
  every join and beads along its length — the same artefact phase 3 fixed, arriving by
  another route. Mixing towards `--color-shadow-deep` keeps every line opaque. Tried it the
  other way first and the beading was plain in a screenshot.
- **No line writes depth any more.** The terrain already has, so a run still hides behind a
  ridge, and `depthTest` stays on — drawing the picked run through the mountain would put it
  somewhere it is not. What this avoids is one run's depth rejecting another's where they
  cross, which became a real risk once the picked run started drawing last.
- **What recedes is decided by what the reader pointed at, and by nothing else.** Fading runs
  by pitch would be a steepness ramp with extra steps (SPEC §8).
- **Search is an addition beyond SPEC §4's filter list**, agreed in session. It is a fourth
  field on `RunFilter`, so it is one tested predicate rather than a second concept beside the
  filter, and it stays in React state like the others — not in the URL, which would also mean
  the hash is no longer just `#run=`.
- **The camera does not move when a run is selected.** SPEC §4 makes it cinematic until
  grabbed, and phase 5's first-person run camera is the designed "take me there". Auto-rotate
  now stops once a run is picked or the list is narrowed, which in a two-pane layout is the
  difference between cinematic and a fidget.
- **`maxDistance` is still measured against the whole mountain**, not the closer framing, or
  the pull-back would stop short of the massif.
- **The table keeps every filtered row in the prerendered HTML.** The list pane scrolls with
  CSS, nothing is windowed, and nothing moved to `useSearchParams` (SPEC §9). Checked on the
  build: 169 `<tr>`, 76.7 KB gzipped against phase 3's 75 KB.
- **`min-w-3xl` on the table was an asserted minimum, not a real one.** Its true min-content
  is 529px; left as it was the table scrolled sideways inside the list pane for no reason.

**Verified:** 159 tests green, format/lint/typecheck/build clean, console clean apart from
the `THREE.Clock` deprecation phase 2 already recorded. In the browser: a selected run reads
instantly among the other 167 and survives being zoomed into a screenshot; hovering a row
lights its line and hovering a line lights its row; `ptarmigan` narrows to 7 of 168, which is
what the test asserts; filtering to Expert leaves 27 in both views, removed rather than
receded; a cold reload of `#run=883614835` restored Headwall at 22°, 23°, SW 207°, 252m,
673m, profile 2583m→2331m, matching `runs.json`. Checked at 1710, 1280 and phone widths.

### Revised again, for the map

Sat in front of the two panes, the map was still sharing the page rather than leading it:
two scrollbars down the middle, a stats card parked across the terrain, and 270px of filter
controls standing between the reader and the run list.

**Done**

- [x] **One scroll region.** The map pane is `sticky top-0 h-svh` and the list scrolls past
      it in the document's own scroll. The inner scroller is gone, and with it the second
      scrollbar and the width it was taking off the table.
- [x] **Nothing on the terrain but the header.** `run-panel.tsx` moved to the head of the
      list, laid out across rather than down, with the profile boxed beside the numbers
      instead of stretched over the full pane.
- [x] **Filters fold away.** Search stays out; grade, aspect and vertical sit behind a
      disclosure that carries a count of how many are set. Chrome above the list drops from
      about 270px to about 130px.
- [x] **The list collapses.** A control in the map's corner folds the whole pane away and
      gives the terrain the full window.
- [x] Long run names clip rather than wrap, so 168 rows stay one height to scan.

**Decisions worth recording**

- **Collapsing hides the list, it never unmounts it.** Without WebGL the table is the site,
  so the rows stay in the document and the pane opens by default — which is what the
  prerendered HTML carries and what a visit without JavaScript gets (SPEC §9).
- **Folded away, the reopen control carries the selected run's name.** A run picked on the
  terrain has nowhere else to report itself once the panel is shut.
- **Collapsing does not reframe the camera.** `openingFraming` is still frozen at first
  render (the phase-2 hardening): a wider pane widens the frustum and shows more mountain,
  rather than yanking a camera the viewer may have already moved.
- **The column headers are no longer sticky.** The block above them changes height with the
  selection, so pinning them under it would mean a magic offset that is wrong half the time.
  The five figures are labelled in the panel directly above.
- **`max-w-0` alone clipped the name column to 47px** — the auto table layout handed the
  slack to the other six columns. It needs `w-full` beside it to take the slack back.

**Verified:** 159 tests green, format/lint/typecheck/build clean. In the browser: one
scrollbar and no inner scrollers at all; the map holds while 168 rows scroll past it;
collapsing gives the canvas the full width within about 120ms and all 168 rows stay in the
DOM while it is shut; reopening restores Headwall at 22°, 23°, SW 207°, 252m, 673m, matching
`runs.json`. Build carries 169 `<tr>`, 76.6 KB gzipped.

**Known, accepted:** at 1300 the list pane is at its narrowest and 16 of the longest run
names clip. Widening it further would come out of the map, and the pane now folds away
entirely when the map is what matters.

### Revised again, for finding the run you picked

Sat in front of it with the list on screen, picking Marmot out of the 168 still meant
hunting for it. The cause was not contrast. Marmot faces **NW 325°**, the opening camera
stands due south of the massif, and the overlay is depth tested against the terrain — so the
run was foreshortened to almost nothing and then partly eaten by its own ridge. A line that
is not drawn cannot be styled into visibility.

**Done**

- [x] `lib/terrain-mesh.ts` — `fitDistance` factored out of `openingFraming` and generalised
      to an arbitrary azimuth and elevation, then `focusFraming`: where to stand to look at
      one run, given where the viewer is already standing. `openingFraming`'s numbers are
      unchanged, and its existing tests pin that
- [x] `components/terrain-scene.tsx` — a 900ms eased flight of both `camera.position` and
      `controls.target`, cancelled the moment the controls are grabbed, instant under
      `prefers-reduced-motion`
- [x] `components/run-overlay.tsx` — a gold halo under the casing on the picked run, and a
      thin trace of it drawn through whatever is standing in front of it

**Decisions worth recording**

- **This reverses "the camera does not move when a run is selected."** That decision read
  SPEC §4's "cinematic until grabbed" as "never moved by the app", and pointed at phase 5's
  first-person camera as the designed "take me there". Both halves still hold — the flight is
  abortable by a grab, and riding the polyline is still phase 5 — but neither answers _where
  on this mountain is the run I just picked_, which is a question the list asks 168 times.
- **It reverses "drawing the picked run through the mountain would put it somewhere it is
  not"** — but only for a 1.5px trace under a 15px stack, and only for the one run the reader
  asked about. The full-strength line is still depth tested and still stops at the ridge; what
  the trace says is "it carries on", not "it is here". The alternative is a run that appears
  to end in the middle of the mountain.
- **The azimuth is kept unless the camera is behind the slope.** A viewer who has orbited
  somewhere keeps their view and is only brought closer, which is the gentler move. The swing
  fires on one dot product against the run's own baked `aspect_deg` — no raycasting, and the
  bake already measured the number.
- **Selection moves the camera; hover never does.** The list is 168 rows long and a camera
  that answered every one on the way past would be a strobe.
- **Clearing the selection leaves the camera where it is.** A pull-back nobody asked for
  would also throw away a manual orbit.
- **Distance is clamped into OrbitControls' own range**, or the 68m Marmot-to-Lookout
  connector frames at about 100m and flies the camera into the ground.

**Verified:** 171 tests green (12 new, including the swing, the clamps, the preserved
elevation angle and Marmot's own committed geometry), format/lint/typecheck/build clean,
console clean apart from the `THREE.Clock` deprecation phase 2 already recorded. In the
browser: Marmot swings round to its NW face and reads instantly; West Bowl Gully — near-white
on pale ground, the case the casing alone loses — reads with the halo; hovering rows lights
lines without moving the camera; grabbing mid-flight stops it; on Pika the trace shows the
buried section while the core resumes where the run is actually visible.

**Not verified at runtime:** the `prefers-reduced-motion` branch is typechecked and in place
but was not exercised against the emulated media query.

### Revised again, for getting back off the run you picked

The flight had no return leg. Pick Larch, clear it, and the camera stays on Larch's framing
with `controls.target` still on its centre — so zooming out orbits Larch and swings the
massif out of frame rather than backing away from it. Recovery needed a right-drag pan,
which nothing on the page says exists. Worse, filtering the picked run away sets `selected`
to null through `visibleIds`, `RunPanel` falls back to its empty state, and the clear
control disappears with it: camera parked on a run, nothing on screen to undo it.

**Done**

- [x] `components/terrain-viewer.tsx` — a **Reset view** control in the map's bottom-left,
      conditional on nothing, driving the scene through a `resetSignal` counter it owns.
      Inside the WebGL branch so it does not float over the no-GPU notice, outside the
      `aria-hidden` canvas wrapper so it is reachable by keyboard
- [x] `components/terrain-scene.tsx` — the flight setup factored out of the selection effect
      into `flyTo`, so selection and reset share one path including the reduced-motion
      branch; a `movedByApp` ref; the `selectedId === null` early return turned into the
      return-home branch
- [x] `components/run-panel.tsx` — the bare `✕` became a bordered, labelled **Clear ✕**

**Decisions worth recording**

- **This narrows "clearing the selection leaves the camera where it is" rather than
  reversing it.** Clearing now hands back the flight and only the flight: untouched since
  the camera landed, it returns; orbited since, `onStart` has already dropped `movedByApp`
  and the view stays. The old rule's reason — that a pull-back nobody asked for throws away
  a manual orbit — is exactly what the condition protects.
- **The same branch covers a filter hiding the picked run**, which is the clearing nobody
  pressed a button for and the one that used to leave no button to press.
- **Reset is a counter, not a flag.** Pressing it twice has to fly twice, and the scene
  reports no arrival for a flag to be cleared on. It is compared against the last value
  seen rather than against zero, so a re-run of the effect cannot yank the camera.
- **Reset does not clear the selection.** Camera and selection are different questions;
  wanting the whole mountain back with a run still lit is a reasonable thing to want.
- **The control is always on screen.** "Appears once the camera has moved" would mean
  comparing against the opening framing every frame and pushing that into React state, to
  make the escape hatch conditional on the state the viewer is least able to assess.

**Verified:** 171 tests green — no new ones, and none earned: `openingFraming` and
`focusFraming` are untouched and already pinned, and what changed is wiring and chrome.
format/lint/typecheck clean, console clean apart from the `THREE.Clock` deprecation. In the
browser, all four legs: Larch flies in; clearing flies back to the whole massif with the
search filter intact; dragging to a low angle and then clearing leaves the camera there;
Reset view returns from it. At 700px the layout stacks, the list toggle drops away and Reset
view is still in the map's corner.

## Phase 4 — Conditions route handler ✅ done

`/api/conditions/[slug]` proxying Open-Meteo, with cache headers. Every field nullable.

Shipped with the conditions strip that reads it. SPEC §4 lists the strip and no phase owned
it, SPEC §15 needs it to call the project done, and a route handler nothing calls is not a
deliverable. Agreed in session before starting.

**Gate (SPEC §11):**

- [x] Tests against recorded Open-Meteo fixtures — `tests/conditions.test.ts`, four fixtures
- [x] **An API-down case** — `tests/conditions-route.test.ts`: a refused connection, a
      timeout, a 429/500/503, a 200 carrying HTML, and a 200 carrying an Open-Meteo error

### Done

- [x] `lib/conditions.ts` — `conditionsUrl` and `parseConditions`, pure and tested in node,
      the same split as `lib/run-list.ts`: the mapping is where the mistakes are, the handler
      is fetch and headers
- [x] `app/api/conditions/[slug]/route.ts` — slug lookup, one fetch, cache headers
- [x] `components/conditions-strip.tsx` — four readings below the resort facts
- [x] `lib/format.ts` — `wind()` and `utcTime()`. `celsius()` and `centimetres()` were
      written in phase 0 for this and had been unused ever since
- [x] `tests/fixtures/open-meteo-*.json` — three recorded live, one derived and marked so

### Decisions worth recording

- **An upstream failure is 502, not a 200 of nulls.** This reverses the comment committed
  with the `Conditions` type in phase 0, and `lib/types.ts` has been corrected rather than
  left contradicting the code. The handler is a gateway; answering 200 with a well-formed
  reading of nulls makes "Open-Meteo is down" indistinguishable from "no snow fell", which at
  a ski resort are opposite facts. The page still never blanks — that is the strip's job, and
  it renders a dash for a failed response exactly as it does for an absent variable. The
  fields stay nullable for the reason they always should have: Open-Meteo omits a variable
  its model does not carry at a location.
- **`stale-if-error` is what the 200-of-nulls was really for.** A cache holding a recent
  reading keeps serving it through an outage, so an outage degrades to the last _real_
  reading rather than to a fabricated one. Full header:
  `public, s-maxage=900, stale-while-revalidate=3600, stale-if-error=86400`. 900s is
  Open-Meteo's own `current.interval`; asking more often returns the same numbers.
- **Snow depth arrives in metres and is published in centimetres.** `current_units.snow_depth`
  is `"m"` while `snowfall` is `"cm"` in the same response. Scaled by 1000 and back by 10
  rather than by 100, or 2.69m reads as 268.99999999999994cm.
- **A rolling 24 hours, not the calendar day.** `hourly=snowfall&past_hours=24` summed,
  because `daily=snowfall_sum` answers "since midnight", and at 9am that is not what
  `snowfall_cm_24h` promises.
- **Every unit is asserted against the response's own `*_units` block.** A unit change
  upstream would not crash anything — metres published as centimetres is a plausible-looking
  number — so `tests/conditions.test.ts` pins `snow_depth: "m"`, `snowfall: "cm"`,
  `temperature_2m: "°C"` and `wind_speed_10m: "km/h"` on both fixtures. If a re-recording
  ever disagrees, the units fail before the arithmetic does.
- **The reading is printed on the mountain's clock, not UTC and not the reader's.**
  "21:00 UTC" is the correct instant and tells a skier nothing; "3:00 PM MDT" is the number
  they can hold against their own watch. `timezone=auto` makes Open-Meteo resolve the zone
  from the coordinates, which is also the only version of this that works for Niseko without
  this project keeping a timezone table.
- **The zone is carried as an IANA name, never as a fixed abbreviation.** Alberta is MDT for
  most of a ski season and MST for the rest of it, so "Mountain Standard Time" would be wrong
  from March to November. `Intl` derives the abbreviation from `America/Edmonton` and the
  instant, and gets the changeover right on its own. Open-Meteo's own
  `timezone_abbreviation` is no help — it answers "GMT-6".
- **`observed_at` stays a UTC instant in the JSON, and the local time is derived for display.**
  Open-Meteo returns a naive wall clock plus `utc_offset_seconds`; `toInstant` puts those back
  together. A timestamp in a payload should be unambiguous, and the clock the reader wants is
  a rendering question, not a storage one.
- **"Weather from Open-Meteo", not a bare "Open-Meteo".** The strip carries provenance for
  SPEC §8, and a brand name on its own does not tell a reader whether they are looking at a
  source or a reading. It is the footer's existing wording, so the two agree.
- **The Lake Louise fixture cannot prove either of those**, because it is September and every
  snow value in it is a real zero — a unit conversion and a sum can both be wrong in every
  way and still produce 0. The second fixture is Aoraki / Mount Cook, recorded the same day,
  in late winter: 2.69m of depth and 3.43cm over 11 of the 24 hours.
- **The strip is a client component, and that is not a style preference.** Awaiting a runtime
  fetch in a server component turns the whole route dynamic and takes the 168 prerendered
  rows out of the served HTML — the same trap phase 3 avoided by keeping the selection in the
  hash rather than in `useSearchParams` (SPEC §9). Checked on the build: still `●`, still 169
  `<tr>`.
- **A failed request and an absent variable render identically**, because to a reader they
  are the same thing: no number. There is no retry button, no spinner and no error text. What
  the strip does drop is the timestamp: with no reading it says "Open-Meteo" and not a time.
- **The slug is validated against `resorts.json`, and that is the security property.** The
  lat/lon that reach Open-Meteo are only ever committed values, and an unknown slug is a 404
  answered before any request is made. `plannedResorts()` is a static import compiled into
  the function; `readResort()` reads `public/` off disk at `process.cwd()`, which is a
  build-time pattern and not reliably there in a deployed function.
- **One attempt, 4s timeout, no retry** — deliberately unlike `scripts/bake/cache.ts`'s
  `[2000, 8000, 20000]` ladder. That is right for a background job and wrong inside a
  visitor's request, where a retry only makes them wait twice. The cache directives absorb
  the blip instead.
- **This is the project's first network stub.** Everything else is tested against a recorded
  fixture with the `fetch` left uncovered, which is the house pattern and is what
  `tests/conditions.test.ts` still does. The gate names an API-down case, and there is no way
  to reach one without intercepting the call — `vi.stubGlobal` is built into vitest, so it
  cost no dependency and no `setupFiles`.

**Verified:** 212 tests green (41 new), format/lint/typecheck/build clean. The build still
lists `/resorts/[slug]` as `●` prerendered and `/api/conditions/[slug]` as `ƒ` dynamic, and
the built `lake-louise.html` still carries 169 `<tr>` at 77,492 bytes gzipped. Live:
`/api/conditions/lake-louise` answers 200 with the full header and a real reading,
`/api/conditions/whistler` answers 404 `no-store` without calling anyone. In the browser the
strip reads 7°C, 0cm, 0cm, 13km/h from SE under the facts, with
`Weather from Open-Meteo · 3:00 PM MDT` beside it — and `/api/conditions/niseko` resolves
`Asia/Tokyo` off the same code path; with `fetch` forced to 502 the four readings become dashes, the timestamp
disappears, and all 168 rows, the disclaimer and the avalanche.ca link are untouched. Console
clean apart from the `THREE.Clock` deprecation phase 2 already recorded. Checked at 1456,
1280 and phone widths; the strip's min-content is 80px, so it wraps rather than overflowing.

**Found and fixed during that pass:** the strip broke the header's own scrim. The gradient
over the canvas fades from its midpoint, and the facts used to end at 64% of the header;
four more readings pushed content to 74%, so "SNOW DEPTH" was being read against a lit
mountain face at about a third opacity. The fix is the invariant rather than a nudge — the
scrim is now solid to where content ends (`via-85%`) and fades through the padding below it,
and the padding came down from `pb-24` to `pb-12` so the taller header does not simply push
the whole scrim further down the mountain. Net effect on the west face, where this mountain
keeps its runs: none.

**Known, accepted:** every snow number at all six resorts is currently zero, because it is
September. That is SPEC §13's risk and decision D3 closes it with baked historical snow in
phase 6, not here.

## Phase 5 — Sun/shade + first-person run camera ⬜

Directional light positioned by `suncalc`. The run's polyline becomes a camera path at
skier speed, look-ahead target a few samples down the line.

**Gate:** known sunrise/sunset asserted for a fixed date and latitude; camera path stays
on the polyline within tolerance.

---

## ⛳ Valid stopping point

**After phase 5, with three resorts baked, this is a finished, pinnable thing.**
Terrain, runs, stats, filters, sun and a first-person camera. SPEC §11 is explicit:
everything past here is addition, not completion. If the calendar tightens, stop and ship
rather than half-building phase 7.

---

## Phase 6 — Historical snow charts ⬜

Monthly snowfall and depth from the Open-Meteo archive, baked as JSON rather than fetched
per visitor. This is what closes the September problem (decision D3).

**Gate:** baked archive JSON matches a recorded API response; chart renders from a fixture.

## Phase 7 — Aspect rose + comparison view ⬜

Polar chart of run distribution by direction; two resorts side by side at identical scale.

**Gate:** rose bucket counts match `runs.json`; comparison renders both at one scale.

## Phase 8 — Dynamic OG images ⬜

`/api/og/[slug]/[run]` via `ImageResponse`, from baked data only — no network call, so a
shared link can't fail on someone else's API.

**Gate:** route returns a valid PNG for a known run; visual check of one card.

## Phase 9 — Remaining resorts, polish, deploy ⬜

**Gate:** `npm run bake -- --all` green, SPEC §10 budget met, live at
`treeline.aidenkopec.com`.

---

## Scope reminder (SPEC §11)

Phases 1–5 are the two-week project. Phases 6–9 are what make this three to four weeks at
evening pace.
