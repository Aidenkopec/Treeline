# Treeline — phases

Progress tracker for [SPEC.md](./SPEC.md) §11. Each phase ends working, committed and
deployable, and runs in its own session with its own verification gate.

**Status: phase 3 done. Phase 4 next.** Lake Louise's 168 runs are
drawn on the terrain coloured by difficulty, with filters, a per-run stats panel, an inline
SVG elevation profile and the sortable HTML table. 143 tests green.

> **Next action:** phase 4 — `/api/conditions/[slug]` proxying Open-Meteo with cache
> headers, every field nullable, tested against recorded fixtures including an API-down
> case. `lib/types.ts` already carries the `Conditions` shape and
> `app/api/conditions/[slug]/route.ts` is a skeleton from phase 0.

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

## Phase 4 — Conditions route handler ⬜

`/api/conditions/[slug]` proxying Open-Meteo, with cache headers. Every field nullable.

**Gate:** tests against recorded Open-Meteo fixtures, **including an API-down case**.

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
