# Treeline — phases

Progress tracker for [SPEC.md](./SPEC.md) §11. Each phase ends working, committed and
deployable, and runs in its own session with its own verification gate.

**Status: phase 5 done. The ⛳ stopping point is reached once three resorts are baked.**
Lake Louise's 168 runs are drawn on the terrain coloured by difficulty, with search,
filters, a per-run stats panel, an inline SVG elevation profile and the sortable HTML
table, laid out as a map beside a list. Picking a run flies the camera to it, and Reset
view always brings the whole mountain back. Today's snow, temperature and wind read live
from Open-Meteo under the resort facts, on the mountain's own clock. The mountain itself is
a winter surface, remapped from Esri's summer imagery at bake time rather than
photographed, and it is lit by the sun that is actually over it at an hour the reader
picks — with the shadows that sun throws. 260 tests green.

> **Next action:** bake Sunshine Village and Panorama, which is what the ⛳ stopping point
> below is waiting on. Everything after that is phase 6 onward and is addition rather than
> completion.

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
- [x] `lib/format.ts` — `wind()` and `observedAt()`. `celsius()` and `centimetres()` were
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
- **`stale-while-revalidate` is what the 200-of-nulls was really for.** A cache holding a
  recent reading keeps serving it while a refetch runs, so a blip degrades to the last _real_
  reading rather than to a fabricated one. Full header:
  `public, s-maxage=900, stale-while-revalidate=3600`. 900s is Open-Meteo's own
  `current.interval`; asking more often returns the same numbers. This header was written
  with `stale-if-error=86400` on the end and reviewed with it removed: **Vercel supports
  neither `stale-if-error` nor `proxy-revalidate` for server-side caching, and caches no 502
  at all** (its cacheable statuses are 200, 404, 410, 301, 302, 307, 308). So an outage past
  the hour is a 502 and a strip of dashes, which is the honest outcome — but it is not the
  one the directive promised, and a header should not describe behaviour the deploy target
  does not give.
- **Snow depth arrives in metres and is published in centimetres.** `current_units.snow_depth`
  is `"m"` while `snowfall` is `"cm"` in the same response.
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
- **The Lake Louise fixture cannot prove the metres-to-centimetres scaling or the rolling
  sum**, because it is September and every snow value in it is a real zero — a unit
  conversion and a sum can both be wrong in every way and still produce 0. The second fixture
  is Aoraki / Mount Cook, recorded the same day, in late winter: 2.69m of depth and 3.78cm
  over 12 of the 24 hours.
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

**Verified:** 215 tests green (44 new), format/lint/typecheck/build clean. The build still
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

**Found and fixed in a comment review afterwards**, and all three were comments rather than
code until one of them turned out not to be: `sumSnowfall` returned 0 when `hourly.snowfall`
arrived present but with every hour null, publishing "no reading" as "0cm" — the exact
inversion the file's own doc comment forbids, now reproduced by a test and fixed. Three
comments justified themselves with floating-point behaviour that does not occur (`2.69 * 100`
is exactly 269, and the Mount Cook hourly array sums to exactly 3.78 with a plain
accumulator), and one of them cited a number, 3.43, that appears nowhere in the fixture; a
comment that invents a constraint makes the next reader preserve an odd line believing it is
load-bearing. And the header leaned on `stale-if-error`, which Vercel does not honour. The
rest of the pass cut narration: one rationale had been restated seven times, and two doc
comments were longer than the code under them.

**Known, accepted:** every snow number at all six resorts is currently zero, because it is
September. That is SPEC §13's risk and decision D3 closes it with baked historical snow in
phase 6, not here.

## Winter drape ✅ done

The mountain is snow-covered. Esri's imagery is a summer scene, there is no seasonal
variant of it to swap in, and the bake now remaps it to a winter surface from the source
pixels' own colour.

Not in SPEC §11. The drape was baked in phase 1 and draped in phase 2 and no phase has
owned its appearance since, so a green mountain sat there reading as a bike map — SPEC §15
needs a visitor who has never skied the place to recognise what they are looking at.
Agreed in session before starting. Taken before phase 5 because phase 5 aims the light
this change had to retune, and tuning that twice would have been tuning against a target
about to be deleted.

### Done

- [x] `scripts/bake/winter.ts` — `winterize`, a pure remap over the raw mosaic. Luminance
      carries the conifer/snow split, saturation only holds rock back from going white
- [x] `scripts/bake/imagery.ts` — the one seam, between `fetchMosaic` and the JPEG encode.
      Signature unchanged, and deliberately still takes no `Grid`
- [x] `tests/winter.test.ts` — the landcover classes, and SPEC §8 tested as a safety rule
- [x] `components/terrain-scene.tsx` — lighting retuned for a bright drape; three comments
      whose premise this change deleted
- [x] `components/run-overlay.tsx` — receded runs mix toward `--color-rock`, not the ground
- [x] `components/site-footer.tsx`, `README.md` — attribution discloses the derivation

### Decisions worth recording

- **Synthesized, not photographed.** Real winter imagery was the obvious answer and is the
  wrong one. Sentinel-2 is the only free date-filtered source and it is 10 m/px against
  this drape's 2.98; it carries its own low winter sun, which phase 5 would then be sliding
  a second synthetic sun across; and it depicts one day's real cover, which invites being
  read as current cover on a site whose whole stance is the permanent shape of a mountain.
- **Keyed on colour, never on slope.** A snow line keyed on steepness is the avalanche
  terrain product SPEC §8 forbids, and `grid` is in scope at the call site. `winterize`
  takes a buffer and nothing else, and `tests/winter.test.ts` asserts both that a colour
  maps the same wherever it sits and that the module never names a terrain derivative.
- **The shadow risk measured away.** The worry was that dark pixels are terrain shadow
  rather than forest, which would bake a fixed shadow into a surface phase 5 relights.
  Pearson r between a DEM hillshade and image luminance is −0.254, and strongly shaded
  terrain is _brighter_ than strongly lit terrain — landcover dominates illumination here,
  because Esri curates against shadow the same way it curates against snow.
- **Lambert divides by pi.** The retune was first argued from the claim that 4.2 units of
  light would clip a white drape to flat white and erase the relief. `BRDF_Lambert` is
  `RECIPROCAL_PI * diffuseColor`, so those units land near 1.3 and nothing clips. The
  retune was still needed, for the other reason: on a near-neutral snow the warm sun and
  cool shade are the _only_ colour in the scene, where over a photograph they were a lean
  on one that supplied its own.
- **Recolouring a photograph is not enough, and was the first version's mistake.** Tinted
  and lifted, the drape came back as a _greyscale summer photograph_ — because a summer
  photograph's detail is what says summer. Every tree crown and scree stipple survived the
  remap intact.
- **Snow blankets; that is the whole trick.** Snow fills gullies, rounds edges and erases
  small detail, so an open slope under it is a smooth bright field whose only variation is
  the shape of the ground. That shape is the renderer's job — the mesh normals and the
  light already carry it, and the drape was burying them under summer texture. So the two
  halves are now treated as opposites: snow is keyed and toned from a _blurred_ luminance
  and comes out smooth, forest keeps the _sharp_ luminance because trees really are the
  texture at this scale.
- **Forest is lifted far off photographic darkness, then pulled back.** A winter canopy is
  loaded and reads as grey, not forest green, so toning it from the summer photograph's own
  darkness turned the treed half of the massif into a hole. But lifted too far a canopy gap
  gets as bright as a run corridor, which is the same complaint in the other direction —
  and that one is measured now, by a test that cuts a corridor through a synthetic canopy
  and asserts it comes out at least a third brighter than the trees around it.
- **Snow stops short of white and stays neutral.** Short of white leaves the renderer
  somewhere to put a lit slope. A blue-cast snow fights the gold sun and wins, so the drape
  is near-neutral and the lights carry the hue.
- **The lights are exposed for the mid-tones, not the highlights.** Most of the frame is
  forest, so metering for the brightest snow left the whole massif dim. Sunlit snow is now
  free to blow out, which is what a snowfield does.
- **Receding toward the ground colour promotes a run over snow.** `RECEDED_MIX` mixed
  toward `--color-shadow-deep`, which on a dark photograph was a step back and on snow
  roughly doubles a line's contrast. Retargeted to `--color-rock`, which sits between the
  two backgrounds the drape now has. The casing stays `--color-shadow-deep`.
- **No toggle, no second artifact, no manifest field.** The winter surface replaces
  `satellite.jpg`. SPEC §16 already defers a base-map toggle as a v1 non-goal.

**Verified:** 226 tests green; format, lint, typecheck clean. Lake Louise re-baked at
2.09 MB of the 5 MB budget (SPEC §10) — the remap costs about 40% more JPEG than the
summer drape, which the budget has room for. By eye at the dev server: the massif reads as
winter at the opening framing, run corridors read as white ribbons through dark trees
without the overlay drawn at all, alpine rock bands still carry, and flown in to one run
the gold halo separates over snow while receded runs step back rather than forward.

**Known, accepted:** the key light moved to the camera side of the massif so the face the
opening framing looks at is lit. It was a backlight, which cost nothing on a dark
photograph and left the whole front side flat on a bright one. Phase 5 replaces this
position with a real sun and will have to answer the same question honestly.

### Follow-up — the transfer was not monotonic

The drape above shipped with a defect that reads as a contour map once you look for it: a
grey rim around every snow patch on the mountain.

**The cause was structural, not a mistuning.** The rock term was a band-pass on source
brightness — `smoothstep(138,170,·) * (1-smoothstep(198,224,·))` — multiplied into a pull
toward a _constant_ dark colour. A band-pass on the very quantity being remapped folds the
transfer back on itself. Measured on a grey ramp: source 138 came out 227 while source 169
came out 136, so **brighter ground came out 91 levels darker**, across 29 of 255 levels.
Crossing a patch edge sweeps brightness through that notch, which is what drew the rim.

**Decisions worth recording:**

- **There is no rock class any more, and the drape is better for it.** A cliff the sun was
  not on is already dark in the photograph, so it falls the forest side of the split and
  takes the same cool dark tone — which is what a cliff band under snow looks like anyway.
  Rock was ~1% of the frame, was the sole source of the rim, and measured over Lake Louise
  its interiors barely separated from snow interiors (texture energy 5.79 against 5.36).
  Deleting it is simpler, provably monotonic, and keeps the cliff bands.
- **The saturation gate was inverted.** It was meant to hold rock back from going white.
  Measured, it evaluated to 0.16 where real rock lives and 0.97–1.00 on lying snow — closed
  where it was needed and open where it did harm. It went with the rock term.
- **Classification moved off the raw plane onto a one-texel blur.** Esri's tiles are JPEG,
  so the finest scale in the mosaic is compression rather than ground, and keying canopy on
  it turned flat forest into salt-and-pepper dither. This also fixed a second thing: a
  narrow corridor classified from the radius-3 plane averaged the trees back in and so came
  out dimmer than a wide one.
- **The snow stretch tops out above the brightest ground in the mosaic.** It ended at 196
  where the rock gate did not release until 224, so there was no brightness at which clean
  snow existed. Sharp detail is deliberately _not_ reinjected to give snowfields texture —
  that is the first version's mistake, and measured, the tonal spread within snow was
  already 39 levels without it.
- **Monotonicity is now a test, not a hope.** `tests/winter.test.ts` probes a grey _ramp
  image_ rather than isolated colours — the old suite could not see this defect because it
  probed single pixels, and its rock case sat inside the notch and asserted the bug's own
  output as correct.

**Verified:** 228 tests green; format, lint, typecheck clean. Measured over the real Lake
Louise mosaic, before → after: descending grey levels 29 → **0**; local contrast inversions
in the mid band 56.3% → **15.3%**; forest-band local variation 20.6 → **8.4**; clipped
highlights 2.08% → **1.59%**. Re-baked at 1.73 MB, down from 2.09 MB — there is less
high-frequency content to encode.

**Measured and dropped:** keying rock on image roughness instead of brightness. It is the
obvious replacement and it does fix the fold, but roughness is high at every patch _edge_
as well as on scree, so it drew a softer rim of its own — the mid-band inversion rate only
fell to 39.1% against 15.3% for having no rock term at all.

### Follow-up — aerial perspective

The massif sat against flat page colour, so the far side of the range carried the same
contrast as the near side and the whole thing read as a cut-out rather than as a place.

- **The sky is CSS, not a shader.** A gradient on the wrapper in `terrain-viewer.tsx`, with
  the canvas turned transparent. A custom `ShaderMaterial` would have had to do its own
  output colour-space conversion — three only applies that to its own materials — and a
  screen-space gradient is what a map does anyway.
- **Fog is measured against the mosaic, not against the camera.** Scaled to
  `opening.distance` it wiped the massif out entirely at first; the framing distance is
  fitted to the _runs_ box and is much smaller than the ground the mesh covers. The
  mosaic's diagonal is the honest reference, and it means the far side of a massif sits
  back by the same amount however close the viewer has flown.
- **Phase 5 will re-aim this.** The haze colour is `--color-shade-dim` to match the horizon
  end of the gradient; a real sun position will want both revisited together.

**Known, not fixed:** the terrain mesh is a rectangular slab and its cut edge is visible at
the near corners. Haze does not cover it — that edge is close to the camera, which is
exactly where linear fog is weakest. It wants a skirt or an edge fade, and it is not this
change's to make.

## Phase 5 — Sun/shade ✅ done

Directional light positioned by `suncalc`, casting the shadows that position throws. The
first-person run camera was built against the same data and dropped; it has its own section
below.

**Gate (SPEC §11):**

- [x] Known sunrise/sunset asserted for a fixed date and latitude — `tests/sun.test.ts`,
      derived from the hour angle rather than pinned from the library's own answer
- [x] ~~Camera path stays on the polyline within tolerance~~ — met, and then the camera it
      gated was dropped. See "Built and dropped" below

### Done

- [x] `resorts.json`, `lib/manifest.ts`, `lib/types.ts`, `scripts/bake.ts` — the resort's
      IANA zone through to the manifest, so a slider can say "2pm at Lake Louise" with no
      network call
- [x] `lib/sun.ts` — `sunPosition`, `sunTimes`, `sunDirection`, `openingWallClock`, and the
      wall-clock/instant pair `Intl` has no inverse for
- [x] `lib/view-hash.ts` — the hash parser lifted out of `run-explorer.tsx` and widened to
      carry the hour beside the run, tested without a DOM
- [x] `components/sun-control.tsx` — date, time, the hour on the mountain's clock, and
      sunrise/sunset, beside the filters
- [x] `components/terrain-scene.tsx` — the real key light, an altitude ramp on it and on the
      fill, and a shadow map rendered only when the sun moves
- [x] `lib/format.ts` — `clockTime`, `observedAt` with the zone left unsaid
- [x] `package.json` — `@types/suncalc` dropped

### Decisions worth recording

- **The installed `suncalc` is not the one in anyone's memory.** v2 answers in **degrees**
  with azimuth **clockwise from north**, where every older example is radians from south,
  and its `getTimes` fields are nullable. It ships its own types, so
  `@types/suncalc@1.9` was both redundant and actively wrong — a declaration file
  describing the opposite convention is a trap and it is gone.
- **The sun's vertical component is scaled by the exaggeration, and the terminator is why.**
  Mesh positions are the real terrain under `diag(1, k, 1)`; a direction scales the same
  way, a normal by the inverse transpose, and the two `k`s cancel in `L·N` before either is
  normalised. Normalising leaves one positive factor per pitch — a contrast trim that
  cannot move a sign. So lit and shaded fall exactly where the real mountain has them, and
  among slopes of one pitch the shading is the real proportions to the last digit.
  Unscaled, the sun sits `k` times too low: measured over 67,000 slope-and-sun
  combinations, 6.3% come out on the wrong side of lit.
- **"Known sunrise" has to mean known independently.** Pinning suncalc's own output would
  assert the library as its own reference, which is the mistake `tests/winter.test.ts` was
  rewritten to stop making. The solstice day lengths are derived in the test from the
  hour-angle formula with the obliquity of the ecliptic as the declination, and the noon
  altitudes from `90° − φ ± ε` — textbook identities that owe suncalc nothing. They agree
  to 18 seconds and 0.005°. The February clock times are pinned on top of that as a
  regression anchor, which is all a pin is good for.
- **The shadow frustum is a proven bound, not a guess.** Every mesh vertex lies within
  `hypot(half-diagonal, relief)` of the origin, so an orthographic frustum that wide
  contains the massif at every sun angle — low ones included, which was the worry. At Lake
  Louise that is 5.8m per texel across 2048, against an 11.9m heightmap pixel, so the
  shadow map is provably not what limits the shadow.
- **The shadow camera has to be constructed, not assigned.** Setting `shadow-camera-near`
  and its neighbours as props leaves the projection matrix on the ten-unit box the default
  was built with. The symptom is not a missing shadow: a frustum covering ten metres of a
  ten-kilometre massif reports the whole mountain as shadowed, and the massif renders as
  the sky gradient. `<orthographicCamera attach="shadow-camera" args={…}>` builds it.
- **The map is re-rendered when the sun moves and at no other time.** The terrain is the
  only caster and it never moves, so `shadowMap.autoUpdate` is off and `needsUpdate` is set
  from an effect on the sun direction. Measured at 60fps idle and 60fps with the slider
  being dragged, so SPEC §10 is unaffected by having shadows at all.
- **The light ramps on altitude, not on `N·L`.** The geometry of a slope turning away is
  already the material's job and folding it in here would count it twice. What altitude
  changes is extinction, so the key smoothsteps to nothing over the last twelve degrees
  while the hemisphere term rises to meet it — a blue mountain at night rather than a black
  one, and not a flat overcast day at noon.
- **The opening hour is now on the mountain, unless the sun is down, in which case it is
  solar noon of that same local day.** A visitor arriving at 11pm would otherwise meet a
  black massif, which says nothing about the terrain the rest of the page is about — the
  same kind of framing decision `openingFraming` makes about where to stand. Nothing is
  hidden: the readout states the hour being drawn and the slider is sitting on it.
- **The zone is configuration, not a reading.** Phase 4 gets an IANA name from Open-Meteo's
  `timezone=auto`, but that arrives after hydration, is null when the call fails, and the
  page is prerendered. A zone is a static fact about a place. `Conditions.timezone` stays
  where it is; the two agree, and a test says so.
- **No per-run sun readout, in the panel or the table.** An incidence angle off baked
  aspect and pitch is blind to the ridge in front of the run, so it would disagree with
  what the render shows — and a sortable sun column is a hair from ranking runs (SPEC §8).
  The mountain answers. What the control prints instead is sunrise and sunset, which are
  facts about the place rather than about the render, so the readout still says something
  with no GPU (SPEC §9).
- **The hour travels in the hash; nothing about the camera does.** SPEC §15 ends with
  sending that exact view to a friend. A link that starts moving the camera on arrival is a
  surprise.
- **The haze and the CSS sky were left alone.** The aerial-perspective follow-up flagged
  that a real sun would want both revisited. Looked at across the day and they hold: the
  horizon gradient is a sky, not a sunlit sky, and it does not fight a low sun. Recording
  that it was checked rather than forgotten.

**Verified:** 260 tests green (32 new), format/lint/typecheck/build clean. The build still
lists `/resorts/[slug]` as `●` prerendered and the built `lake-louise.html` still carries
169 `<tr>`, now at 77,760 bytes gzipped against 77,492 — the sun control is 265 bytes of
prerendered HTML and renders its dashes before hydration, the same shape as the conditions
strip. Re-baked: only the manifest moved, so the heightmap, drape and runs are
byte-identical and the bake is confirmed deterministic over the new field.

In the browser at Lake Louise on 14 February: at 9am the marked terrain — which faces west
— is in shade with the far ridge lit; at 2pm the face the opening framing looks at is lit;
at 4:40pm ridge shadows run out across the lower slopes; at 9pm the massif is a blue night
mountain with the runs still readable rather than a hole. Pika faces E 112° and is shaded at
2pm, which is the product working. Without a hash the control resolves to the hour it is on
the mountain, with the right daylight-saving abbreviation. Console clean apart from the
`THREE.Clock` deprecation phase 2 already recorded.

**Closed, and it had been open since phase 3:** `prefers-reduced-motion` was recorded there
as "typechecked and in place but not verified at runtime". It is verified now — with the
query emulated, the flight snaps rather than eases and auto-rotate stays off.

### Built and dropped — the first-person run camera

SPEC §4 and §5.2 both list it, and it was built: `lib/run-camera.ts` walking
`ProfileSample.d` rather than the sample index, its gate met at 0.01m off the polyline, the
near plane dropped for the ride and restored after, four ways out of it, and a
reduced-motion branch that places the view and holds it. It is not shipped.

- **It does not look like skiing, and it cannot.** The heightmap is 11.9m per pixel and the
  drape is 2.98m; from a few metres off the snow both are a smooth white blur. The thing a
  skier wants from a first-person view is the shape of the fall line at the scale they turn
  on, which is metres, and this project measures the mountain in tens of them.
- **Nor can the camera get down to a skier's eye.** `DRAPE_OFFSET_M` lifts the line eight
  exaggerated metres clear of the mesh because the bake samples elevation bilinearly while
  the mesh spans the cell with two flat triangles, and a camera below those triangles is
  looking at the inside of the mountain. So the ride sat about five and a half real metres
  up, which reads as a drone.
- **A view that misrepresents the terrain is worse than no view**, on a site whose whole
  claim is that the numbers come from the elevation model rather than from a trail map. The
  camera flight onto a picked run already answers "where on this mountain is it", which is
  the question phase 3 raised and the one a reader actually asks.
- Decided in session after looking at it running. The elevation profile, the flight and the
  sun are what the `profile` samples are for.

---

## ⛳ Valid stopping point

**After phase 5, with three resorts baked, this is a finished, pinnable thing.**
Terrain, runs, stats, filters and a real sun. SPEC §11 is explicit: everything past here is
addition, not completion. If the calendar tightens, stop and ship rather than
half-building phase 7.

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
