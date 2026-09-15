# Treeline — phases

Progress tracker for [SPEC.md](./SPEC.md) §11. Each phase ends working, committed and
deployable, and runs in its own session with its own verification gate.

**Status: phase 1 done. Phase 2 next.** Lake Louise is baked and committed — heightmap,
satellite, 168 runs and a manifest entry, 1.97 MB of the 5 MB budget. 102 tests green.

> **Next action:** phase 2 — render the baked heightmap as terrain with the satellite
> texture draped over it. The artifacts are on disk and the manifest is populated, so the
> scene has real data to read from the first commit.

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

## Phase 2 — Next.js app renders that terrain ⬜

Plane geometry displaced by the heightmap, satellite texture draped, React Three Fiber.
Vertical exaggeration tuned by eye per resort (SPEC §13 flags flat-looking terrain as a
real risk; the knob is already in `resorts.json`).

**Gate:** screenshot, human review.

## Phase 3 — Run overlay, stats panel, filters, elevation profile ⬜

Runs drawn on the surface coloured by difficulty. Per-run stats panel. Filters by aspect,
difficulty and minimum vertical. Inline SVG elevation profile — no chart library.
The sortable HTML table (SPEC §9) belongs here too: filters operate on both views.

**Gate:** stats in UI match `runs.json`; filter unit tests; profile renders from a fixture.

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
