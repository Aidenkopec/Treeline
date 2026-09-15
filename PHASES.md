# Treeline — phases

Progress tracker for [SPEC.md](./SPEC.md) §11. Each phase ends working, committed and
deployable, and runs in its own session with its own verification gate.

**Status: phase 1 in progress (~40%).** Foundation is done; the bake pipeline's pure math
is implemented and tested, but nothing has been baked yet and no artifacts exist.

> **Next action:** implement the four derived-stat functions in `scripts/bake/runs.ts`.
> They are pure functions over a heightmap, so they can be written and tested without any
> network access — same as the three modules already finished.

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
- [x] `resorts.json` — all six resorts configured
- [x] vitest + tsx wired; `npm test`, `npm run typecheck`, `npm run lint`, `npm run bake`
- [x] Route handler skeletons for conditions (phase 4) and OG images (phase 8)
- [x] AGENTS.md records the §8 rules as non-negotiable in an implementation session

**Verified:** build passes, lint and typecheck clean, 48 tests green, no console errors,
no layout overflow from 320px up.

---

## Phase 1 — Bake pipeline, Lake Louise only 🟡 in progress

**Deliverable:** real artifacts for one resort — `heightmap.png`, `satellite.jpg`,
`runs.json`, manifest entry.

**Gate (SPEC §11):**
- [x] Downhill-only filter asserted against a fixture containing backcountry ways
- [~] Fixture tile decodes to known elevations — *decode is tested against synthetic
      buffers; still needs a real terrarium `.png` fixture*
- [ ] Golden pitch/aspect for two hand-checked Lake Louise runs, within tolerance

### Done
- [x] `tiles.ts` — Web Mercator tile math, 8/8 functions, 8 tests (SPEC §13's hard part)
- [x] `terrarium.ts` — elevation decode, 3/3 functions, 7 tests
- [x] `terrain.ts` — Horn's method slope/aspect + bilinear sampling, 5/5 functions, 12 tests
- [x] `overpass.ts` — query builders and the `piste:type=downhill` safety filter, 11 tests

### Remaining, in order

**1. Derived stats** — `scripts/bake/runs.ts` (5 stubs). Pure math, no network:
- [ ] `sampleProfile` — resample a polyline to a fixed ground interval against the DEM
- [ ] `averagePitch` — mean slope, weighted by segment length
- [ ] `sustainedMaxPitch` — sliding window, so one noisy DEM cell can't report a cliff
- [ ] `meanAspect` — averaged as unit vectors, not raw degrees (350° and 10° average to N, not S)
- [ ] `deriveRun` — assemble one complete `Run`

**2. Network and raster I/O:**
- [ ] `overpass.ts` `runQuery` — POST, with the rate limit respected
- [ ] Tile download + stitch via `sharp` (elevation and imagery share `tiles.ts`)
- [ ] `imagery.ts` `bakeSatelliteTexture`

**3. Emit** — `scripts/bake/emit.ts` (5 stubs):
- [ ] 16-bit `heightmap.png`, `satellite.jpg`, `runs.json`, manifest update
- [ ] `reportAssetWeight` against the SPEC §10 budget

**4. Orchestrate** — `scripts/bake.ts` (2 stubs): `bakeResort`, `checkResort`

**5. Close the gate:**
- [ ] Bake Lake Louise for real; commit the artifacts
- [ ] Hand-check two runs against the published trail map and a topo
- [ ] Commit those as golden values and un-skip `tests/runs.golden.test.ts`

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
