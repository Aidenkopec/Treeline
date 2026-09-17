# Treeline — phases

Progress tracker for [SPEC.md](./SPEC.md) §11. Each phase ends working, committed and
deployable, and runs in its own session with its own verification gate.

**Status: phases 0–5.11 done. All six resorts baked. 422 tests green.** The ⛳ stopping point
(three resorts) is passed. Everything past it is addition, not completion.

> **Next action:** phase 6, or phase 9's deploy. Nothing is blocking either.

Each done phase lists what shipped, the constraints that still bind future work, and what is
still open. Rationale that no longer constrains anything lives in git history.

---

## Phase 0 — Foundation ✅ done

Not in SPEC §11; §11 assumes a project already exists.

- [x] Next.js 16 + React 19 + TypeScript + Tailwind v4, App Router, no `src/`
- [x] `app/globals.css` — Imhof relief palette, Archivo width scale
- [x] `lib/types.ts` — the build-time↔runtime contract, every SPEC §6 field typed
- [x] `components/difficulty-mark.tsx` — difficulty by shape, not colour alone
- [x] SPEC §8 disclaimer, inbounds framing and attribution in the root layout
- [x] Resort index with an honest "not baked" empty state; CSS-only masthead figure
- [x] `resorts.json` — all six resorts configured
- [x] vitest + tsx; Prettier, lint-staged, agent hooks, CI gate
- [x] Route handler skeletons for conditions (phase 4) and OG images (phase 8)

**Gate:** 48 tests, build/lint/typecheck clean, no overflow from 320px up.

---

## Phase 1 — Bake pipeline, Lake Louise only ✅ done

Real artifacts for one resort: `heightmap.png`, `satellite.jpg`, `runs.json`, manifest entry.

- [x] `tiles.ts` — Web Mercator tile math (SPEC §13's hard part)
- [x] `terrarium.ts` — elevation decode
- [x] `terrain.ts` — Horn's method slope/aspect, bilinear sampling
- [x] `overpass.ts` — query builders, the `piste:type=downhill` filter, retry/backoff
- [x] `scripts/bake/runs.ts` — `sampleProfile`, `averagePitch`, `sustainedMaxPitch`,
      `meanAspect`, `deriveRun`
- [x] `scripts/bake/imagery.ts`, `emit.ts`, `scripts/bake.ts` — mosaic, artifacts, manifest,
      `reportAssetWeight` against the SPEC §10 budget

**Constraints**

- `meanAspect` averages unit vectors, not degrees — 350° and 10° average to N, not S.
- `sustainedMaxPitch` is a sliding window so one noisy DEM cell cannot report a cliff.
- Verification is against independent sources, never the pipeline's own output.

**Open, accepted:** one run per OSM way, so a name can appear more than once, and a published
figure may describe a different object than the way carrying its name — the FIS Men's Downhill
_course_ is 3123m/827m, while the OSM way named "Men's Downhill" is the 743m/256m pitch.
Merging ways into one run per trail is bake math and its own change.

**Gate:** 102 tests. Elevation checked against seven OSM surveyed peaks and lift stations
(mean −43m on sharp summits, which is resampling ~30m data) and two runs against Copernicus
DEM GLO-90 (within 0.3° on Eagles Flight). Lake Louise at 1.97 MB of the 5 MB budget.

---

## Phase 2 — Next.js app renders that terrain ✅ done

`/resorts/[slug]`, statically generated, drawing the baked heightmap with the imagery draped.

- [x] `lib/elevation.ts` — the RGB decode, shared by bake and app rather than written twice
- [x] `metres_per_pixel` into the manifest — without it the mesh has no real-world scale
- [x] `lib/terrain-mesh.ts` — heightmap to vertices in metres
- [x] `components/terrain-scene.tsx` — R3F canvas, satellite material, Imhof lighting, orbit
- [x] `components/terrain-viewer.tsx` — WebGL probe and the no-GPU fallback
- [x] Vertical exaggeration 1.8 for Lake Louise, tuned by eye

**Constraints**

- The opening framing is frozen at first render. A resize must not recompute the orbit clamps
  and drag a zoomed-out camera back in.
- The heightmap decodes through a detached canvas, not `OffscreenCanvas` — Safari shipped the
  latter four versions after WebGL2, so the probe was waving through browsers that then
  crashed. The probe releases its WebGL context rather than holding a slot.
- A failed artifact fetch degrades to the no-GPU notice; it must not reach the root error
  boundary and take the facts and the disclaimer with it. A rejected load is not cached.
- A missing or malformed `runs.json` reads as `—`, never as the fact "0 marked runs".

**Open, accepted:** the mesh is a rectangle with hard cut edges rather than a plinth with a
skirt. At phone widths the terrain fits but sits small (SPEC §3). `@react-three/fiber` logs one
`THREE.Clock is deprecated` warning from its own internals — expected in every gate below.

**Gate:** 60fps locked at 2850x1150 (p95 17.2ms) on a 393k-vertex mesh, so no decimation.
Without WebGL the server HTML still carries name, country, elevation range, run count, vertical
scale, baked date and the disclaimer.

---

## Phase 3 — Run overlay, stats panel, filters, elevation profile ✅ done

Four passes: the numbers, then the layout, then finding a picked run, then getting back off it.

- [x] `lib/terrain-mesh.ts` — `lonLatToMesh` / `runMeshPoints`; `fitDistance` generalised out
      of `openingFraming`, then `focusFraming`; `FocusExtent` / `runExtent`
- [x] `lib/run-list.ts` — filter, sort, table cells, pure and tested in node
- [x] `lib/profile-path.ts` — the profile as SVG path data, straight between samples
- [x] `components/run-overlay.tsx` — one drei `<Line>` per run, casing + core, gold halo and a
      ghost trace on the picked one
- [x] `components/run-explorer.tsx` — one filter and one selection driving both views; two
      panes at `xl:`, map sticky beside a list that scrolls in the document
- [x] `components/run-filters.tsx` — search, chips and slider behind a disclosure with a count
- [x] `components/terrain-scene.tsx` — a 900ms eased flight of camera and target, cancelled on
      grab, instant under `prefers-reduced-motion`; **Reset view** through a `resetSignal`
- [x] Selected run in `#run=<id>`, read through `useSyncExternalStore`

**No bake change:** every field phase 3 needed was already in `runs.json`.

**Constraints**

- The selection is in the URL hash, never `searchParams` — `useSearchParams` de-opts the route
  to client rendering and takes the prerendered rows out of the HTML (SPEC §9).
- Filters stay in React state and are deliberately not shareable.
- A run is drawn casing-then-core; the casing writes no depth, or the two z-fight. No line
  writes depth — the terrain already does, so runs still hide behind a ridge.
- A run recedes by **colour, not opacity**. `Line2` overlaps quads at the joins, so a blended
  line composites twice and beads along its length.
- What recedes is decided by what the reader pointed at and nothing else. Fading by pitch is a
  steepness ramp with extra steps (SPEC §8).
- Pitch prints whole degrees; a 30m DEM does not support the decimal. "Stats match
  `runs.json`" means after that rounding.
- Selection moves the camera; hover never does. 168 rows answering on the way past is a strobe.
- Flight distance is clamped into OrbitControls' own range, or a 68m connector frames at ~100m
  and flies the camera into the ground.
- `maxDistance` is measured against the whole mountain, not the closer framing.
- Reset is a counter, not a flag — pressing twice must fly twice — and it does not clear the
  selection. Clearing a selection returns the camera only if the viewer has not orbited since.
- The table keeps every filtered row in the prerendered HTML. Nothing is windowed.

**Open, accepted:** a run line is a small target at the opening camera distance; the table is
the easier path and the accessible one. At 1300 the list pane is narrowest and 16 long names
clip.

**Gate:** 171 tests. `#run=883614835` restores Headwall at 22°, 23°, SW 207°, 252m, 673m,
profile 2583m→2331m, matching `runs.json`. Build carries 169 `<tr>`, 76.6 KB gzipped.

---

## Phase 4 — Conditions route handler ✅ done

`/api/conditions/[slug]` proxying Open-Meteo, plus the strip that reads it. Every field
nullable.

- [x] `lib/conditions.ts` — `conditionsUrl` and `parseConditions`, pure and tested in node
- [x] `app/api/conditions/[slug]/route.ts` — slug lookup, one fetch, cache headers
- [x] `components/conditions-strip.tsx` — four readings below the resort facts
- [x] `lib/format.ts` — `wind()`, `observedAt()`
- [x] `tests/fixtures/open-meteo-*.json` — three recorded live, one derived and marked

**Constraints**

- **An upstream failure is 502, not a 200 of nulls.** Answering 200 with nulls makes
  "Open-Meteo is down" indistinguishable from "no snow fell", which at a ski resort are
  opposite facts. The page never blanks — that is the strip's job, and it renders a dash.
- Header is `public, s-maxage=900, stale-while-revalidate=3600`. 900s is Open-Meteo's own
  `current.interval`. **Vercel honours neither `stale-if-error` nor `proxy-revalidate` and
  caches no 502**, so do not write a directive describing behaviour the target does not give.
- `snow_depth` arrives in metres, `snowfall` in centimetres, in the same response.
- 24h snow is `hourly=snowfall&past_hours=24` summed. `daily=snowfall_sum` means "since
  midnight", which at 9am is not what `snowfall_cm_24h` promises.
- Every unit is asserted against the response's own `*_units` block — a silent unit change
  produces a plausible-looking number, so it must fail before the arithmetic does.
- The reading prints on the mountain's clock, from an **IANA name** never a fixed abbreviation
  (Alberta is MDT for most of a season and MST for the rest). `observed_at` stays a UTC instant
  in the JSON; local time is derived for display.
- The strip is a client component. Awaiting a runtime fetch in a server component turns the
  route dynamic and drops the prerendered rows (SPEC §9).
- A failed request and an absent variable render identically — to a reader they are the same
  thing. No retry button, no spinner. What drops is the timestamp.
- The slug is validated against `resorts.json` and that is the security property: the lat/lon
  reaching Open-Meteo are only ever committed values.
- One attempt, 4s timeout, no retry — unlike the bake's ladder. A retry inside a visitor's
  request only makes them wait twice.
- The Lake Louise fixture cannot prove the metres-to-centimetres scaling or the rolling sum; it
  is September and every snow value is a real zero. The Aoraki / Mount Cook fixture can.

**Open, accepted:** every snow number at all six resorts is currently zero, because it is
September. SPEC §13's risk; decision D3 closes it with baked history in phase 6.

**Gate:** 215 tests. `/api/conditions/lake-louise` answers 200 with the full header;
`/api/conditions/whistler` answers 404 `no-store` without calling anyone;
`/api/conditions/niseko` resolves `Asia/Tokyo` off the same code path. With `fetch` forced to
502 the four readings become dashes and the rows, disclaimer and avalanche.ca link are intact.

---

## Winter drape ✅ done

The mountain is snow-covered. Esri's imagery is a summer scene with no seasonal variant, so the
bake remaps it to a winter surface from the source pixels' own colour. Not in SPEC §11; taken
before phase 5 because phase 5 aims the light this had to retune.

- [x] `scripts/bake/winter.ts` — `winterize`, a pure remap over the raw mosaic
- [x] `scripts/bake/imagery.ts` — the one seam, between `fetchMosaic` and the JPEG encode
- [x] `components/terrain-scene.tsx` — lighting retuned for a bright drape
- [x] `components/run-overlay.tsx` — receded runs mix toward `--color-rock`
- [x] `components/site-footer.tsx`, `README.md` — attribution discloses the derivation

**Constraints**

- **Keyed on colour, never on slope.** A snow line keyed on steepness is the avalanche terrain
  product SPEC §8 forbids. `winterize` takes a buffer and nothing else, and
  `tests/winter.test.ts` asserts the module never names a terrain derivative.
- **Synthesized, not photographed.** Sentinel-2 is 10 m/px against this drape's 2.98, carries
  its own low winter sun for phase 5 to fight, and depicts one day's real cover — which invites
  being read as current cover.
- **The transfer must be monotonic**, and that is a test over a grey _ramp image_. The shipped
  defect was a band-pass on the very quantity being remapped: source 138 came out 91 levels
  brighter than source 169, which drew a grey rim around every snow patch. Probing single
  pixels cannot see this.
- **There is no rock class.** It was the sole source of the rim, ~1% of the frame, and its
  interiors barely separated from snow. A dark cliff falls the forest side and reads correctly.
- Classification runs on a one-texel blur, not the raw plane — Esri's tiles are JPEG, so the
  finest scale in the mosaic is compression rather than ground.
- Snow is keyed and toned from a **blurred** luminance and comes out smooth; forest keeps the
  **sharp** luminance. Snow blankets; the shape is the renderer's job. Reinjecting detail into
  snowfields is the first version's mistake — it returns a greyscale summer photograph.
- Snow stops short of white and stays neutral, so the renderer has somewhere to put a lit slope
  and the lights carry the hue.
- No toggle, no second artifact, no manifest field. SPEC §16 defers a base-map toggle.
- The sky is CSS on the wrapper, not a shader — a `ShaderMaterial` would need its own output
  colour-space conversion. Fog is scaled to the mosaic diagonal, never to `opening.distance`,
  which is fitted to the runs box and much smaller than the ground the mesh covers.

**Open:** the mesh's cut edge is visible at the near corners. Haze does not cover it — linear
fog is weakest close to the camera. It wants a skirt or an edge fade.

**Gate:** 228 tests. Measured over the real mosaic, before → after: descending grey levels
29 → 0; mid-band local contrast inversions 56.3% → 15.3%; forest-band variation 20.6 → 8.4.
Re-baked at 1.73 MB — less high-frequency content to encode.

**Measured and dropped:** keying rock on image roughness instead of brightness. It fixes the
fold but roughness is high at every patch edge as well as on scree, so it draws a softer rim of
its own — 39.1% inversions against 15.3% for no rock term at all.

---

## Phase 5 — Sun/shade ✅ done

Directional light positioned by `suncalc`, casting the shadows that position throws.

- [x] `resorts.json` → manifest — the resort's IANA zone, so a slider can say "2pm at Lake
      Louise" with no network call
- [x] `lib/sun.ts` — `sunPosition`, `sunTimes`, `sunDirection`, `openingWallClock`
- [x] `lib/view-hash.ts` — the hash parser lifted out of `run-explorer.tsx`, widened to carry
      the hour, tested without a DOM
- [x] `components/sun-control.tsx` — date, time, the hour on the mountain's clock, sun times
- [x] `components/terrain-scene.tsx` — the key light, an altitude ramp, a shadow map rendered
      only when the sun moves

**Constraints**

- **The installed `suncalc` is not the one in memory.** v2 answers in degrees, azimuth
  clockwise from north, where every older example is radians from south. `@types/suncalc@1.9`
  described the opposite convention and is removed.
- **The sun's vertical component is scaled by the exaggeration.** Unscaled, the sun sits `k`
  times too low: over 67,000 slope-and-sun combinations, 6.3% land on the wrong side of lit.
- "Known sunrise" means known **independently** — derived in the test from the hour-angle
  formula, not pinned from the library's own answer.
- The shadow camera must be **constructed**, not assigned as props. Assigning leaves the
  projection on the default ten-unit box, which reports the whole massif as shadowed.
- `shadowMap.autoUpdate` is off; `needsUpdate` is set from an effect on the sun direction. The
  terrain is the only caster and never moves.
- The light ramps on **altitude, not `N·L`** — the geometry of a slope turning away is already
  the material's job, and folding it in counts it twice.
- The opening hour is local, or solar noon of that day if the sun is down. A visitor arriving
  at 11pm would otherwise meet a black massif.
- The zone is configuration, not a reading. Phase 4's `timezone=auto` arrives after hydration
  and is null when the call fails; the page is prerendered.
- **No per-run sun readout.** An incidence angle off baked aspect and pitch is blind to the
  ridge in front of the run, and a sortable sun column is a hair from ranking runs (SPEC §8).
- The hour travels in the hash; nothing about the camera does (SPEC §15).

**Gate:** 260 tests. At Lake Louise on 14 February: 9am the marked west-facing terrain is
shaded with the far ridge lit; 2pm the opening face is lit; 9pm is a blue night mountain with
runs still readable. Pika faces E 112° and is shaded at 2pm. Re-baked: only the manifest moved,
so the bake is confirmed deterministic over the new field.

**Built and dropped — the first-person run camera.** SPEC §4 and §5.2 both list it and it was
built, gate met at 0.01m off the polyline. Not shipped, and do not rebuild it: the heightmap is
11.9m per pixel and the drape 2.98m, so from a few metres off the snow both are a smooth white
blur. `DRAPE_OFFSET_M` also holds the line eight exaggerated metres clear of the mesh, so the
ride sits ~5.5 real metres up and reads as a drone. A view that misrepresents the terrain is
worse than no view on a site whose claim is that the numbers come from the DEM.

---

## Phase 5.5 — Lifts and named places ✅ done

The mountain read as a survey rather than a ski area. Not in SPEC §11 as written; SPEC §3
rejects lift _status_ (live operational data, no standard API) while where a lift runs is a
permanent fact.

- [x] `mountain.json` — a fourth artifact beside `runs.json`, read at build time
- [x] A third Overpass query, clipped to `landuse=winter_sports` via `map_to_area`
- [x] Cables drawn over their pylons, surface lifts draped on the snow
- [x] Places as labelled callouts on leader lines, sharing `PlaceMark` with the list
- [x] Lift table and place list below the runs, lift count in the header facts

**Constraints**

- **A lift carries no pitch and no aspect** (SPEC §8). The ground under a cable is not a marked
  run. Enforced three ways: the type has no field, `tests/mountain.test.ts` walks a derived
  lift's keys, and `tests/mountain.golden.test.ts` walks the committed artifact.
- The third query is separate from the runs query on purpose — the downhill filter is a safety
  rule, and a query with no piste clause cannot widen one.
- **Vertical is terminal to terminal, not max−min** — the opposite of a run. A lift crossing a
  gully has not climbed the dip. Both vertical and length are measured on `ground_m`, never
  `cable_m`, so the rendering constant cannot reach a published number.
- Lift polylines are kept exactly as mapped; the OSM nodes are the surveyed pylons, so
  resampling would invent towers and discard real ones.
- One clearance constant (12m), not per-span. Per-span is a relaxation, not a pure function,
  and varying clearance reopens the measured-on-the-ground rule by the side door.
- A lift is a **dark core in a light casing** — inverted from a run, so it can never be misread
  as a grade. Identity by the cableway hatch, so it survives being drawn thin.
- Lifts draw over ordinary runs and under a hovered or picked one: the lifts are the skeleton.
- **Lifts are not clickable.** A straight cable held above the surface has none of the
  foreshortening `focusFraming` exists for, and it would collide with run selection.

**Open:** Grizzly Express Gondola bakes 713m over 2862m, a longer alignment than the operator
publishes — a question about what OSM has mapped, and the bake is not fudged to match a
brochure. Richardson's Ridge Express has 3 towers over 1739m; still under construction.

**Gate:** 328 tests. Verified against physics rather than the pipeline: baked length over OSM's
tagged ride time gives 2.2–2.4 m/s for the three fixed-grip lifts and 4.4–5.6 m/s for the five
detachables. A length wrong by fifteen percent leaves the band.

---

## Phase 5.6 — The labels, inverted ✅ done

5.5 named the lodges and left the lifts to be discovered by pointing. A reader asks "which lift
is that", and a hatch across a cable can only answer "a lift".

- [x] Lifts named always; pointing adds `Vertical 104m · Length 475m` and lights the cable
- [x] Summits named always, with their surveyed height
- [x] Everything else is a mark that answers to being pointed at
- [x] The base-area stack is one mark with a count, opening one box of five rows
- [x] `lib/label-layout.ts` — the whole placement pass, pure

**Constraints**

- **Places cannot be ranked, so they are not.** At Lake Louise the mid-mountain lodge and the
  sushi counter in the base are both `amenity=restaurant`. Any ranking would be invented here
  rather than read, so crowding is settled geometrically.
- Placement is **screen space**, not baked lat/lon. Under a free orbit "close on the mountain"
  and "close on screen" are different questions and only the second is the one being asked.
- Occlusion is a heightfield walk against the vertex buffer, not a raycast — the mosaic is
  hundreds of thousands of unindexed triangles and the question is asked per label per move.
- A name slides along its cable; `PlateCandidate` carries absolute spots, not offsets from one
  anchor. Two positions either side of the midpoint places one of ten names on a face.
- A plate sits on one of **eight compass sides**, so it holds while the mountain turns and
  snaps once. Creeping reads as drift; stepping reads as a decision.
- Only decisions are state. A pass reaching the same answer writes nothing.
- Plate width is estimated from the text, never measured — measuring is a DOM read per label
  per pass, which forces a reflow inside the render loop.
- **Ride time is baked, not published.** `aerialway:duration` is transit at full line speed,
  not the ride anyone takes. It stays in the artifact only because
  `tests/mountain.golden.test.ts` divides `length_m` by it as a physics check.

**Open:** plates lag the camera by up to a pass while it swings, so two placed clear of each
other can drift together mid-drag. Fixing it properly means a React render every frame.

**Gate:** 345 tests, checked by eye at both canvas widths and through a full orbit.

---

## Phase 5.7 — The map leads ✅ done

The page was a spreadsheet with a mountain beside it: the dense white half wins that fight
every time. The two-pane layout is gone.

- [x] `components/run-explorer.tsx` — canvas `absolute inset-0` of an `h-svh` frame, everything
      else positioned over it
- [x] `components/run-drawer.tsx` — docked at the right above `xl`, a sheet along the bottom
      below it. Opaque: a backdrop filter over a live canvas is the cheapest way to lose SPEC
      §10's frame rate
- [x] `components/map-chrome.tsx` — the chrome slots, and what measures them
- [x] `components/run-detail-card.tsx` — replaces `run-panel.tsx`, on the map
- [x] `components/grade-filter.tsx`, `chip.tsx` — grade onto the terrain
- [x] `lib/inset.ts` + `terrain-scene.tsx` — the camera composes into what the chrome leaves
- [x] `lib/webgl.ts` — the probe, shared, because the answer decides the layout too
- [x] `components/map-attribution.tsx`, `app/not-found.tsx` — SPEC §8 without a page footer

**Constraints**

- **The camera moves its projection, not itself.** Shifting `camera.position` or
  `controls.target` would put the orbit's centre off the massif, and every drag after that
  swings it out of frame.
- The inset is measured off the drawer's own **box, never its position** — position slides for
  the length of the transition and would drag the mountain along a frame at a time.
- Which edge the inset lands on is pure, in `lib/inset.ts`, so it is settled by `npm test`
  rather than by dragging a window across the breakpoint.
- **A summit name is the one label nothing may push off.** Peaks are placed first against a
  screen empty of everything, chrome included.
- Chrome rects go into `placePlates`' `reserved`, deduped by `sameRects`. Without it a lift
  plate lands under the sun clock and is simply gone.
- Grade **moved** rather than being mirrored. Two controls for one value is a live region that
  announces twice.
- `SiteFooter` left the root layout, so every page renders it and `app/not-found.tsx` had to
  exist. Neither the map line nor the footer is ever the only copy.
- The credits fold behind an ⓘ; the **safety words never do**. Folding credits is what the OSMF
  guidelines allow a map short of room; folding §8 is not.
- **No first-visit acknowledgment gate.** The sites that gate are the avalanche-terrain
  products §8 exists to stay clear of, and ODbL credit accompanies the map, not a modal
  someone accepted once — so the chrome stays either way.
- The desktop drawer is a docked panel: not modal, does not trap focus. The sheet at full
  height is not claimed to be handled.

**Open**

- The sheet toggles rather than drags; there is no drag-to-snap.
- The detail card is in the DOM twice below `xl`, one copy `display: none`.
- The card's height budget is tuned, not derived — three columns, a shorter profile and a
  `short:` variant at 52rem. A card that measured its gap would need none of them.

**Gate:** 356 tests. `#run=883614829` restores Maverick at 25°, 30°, SW 238°, 337m, 796m,
matching `runs.json`. Every route's HTML carries the avalanche.ca link and the ODbL credit with
the drawer open and collapsed. 183 `<tr>`, 80.8 KB gzipped.

**Not verified at runtime:** the no-WebGL branch.

---

## Phase 5.8 — Two edges, two scrims ✅ done

5.7 put the chrome on the mountain without asking how much of the mountain it stood on. At
2000x1164 with the drawer shut: a ~300px masthead, a 785x175 panel owning the bottom-left
quadrant, a 375x315 card over the west face, and two more corners. Four clusters became two
edges, and the masthead came down to ~170px.

- [x] `components/map-chrome.tsx` — `topLeft`/`bottomLeft`/`bottomRight`/`footer` →
      `selection`/`instruments`/`disclaimer`, named for what they are
- [x] `app/globals.css` — `.u-scrim` / `.u-scrim-up` for an edge, `.u-scrim-soft` for chrome
      floating on terrain
- [x] `components/sun-control.tsx` — one row on the bottom edge; `SunTimes` splits out
- [x] `components/chip.tsx` — `GlyphChip`; `grade-filter.tsx` takes `compact`
- [x] `components/run-detail-card.tsx` — un-boxed onto its own soft veil
- [x] `components/resort-identity.tsx` + `conditions-strip.tsx` — facts inline

**Constraints**

- **`Baked` and `Vertical scale` stay visible.** SPEC §8 requires provenance and age visible,
  so the masthead got shorter by layout alone and no fact was removed.
- A scrim is as tall as its own content. Reusing the masthead's gradient let go _under the last
  two rows of type_, because those rows are what make it that tall.
- Chrome off a frame edge needs `.u-scrim-soft`, which comes out of nothing at both ends.
  `u-scrim` on the run card drew a hard horizon across the west face.
- **Empty means every.** `NO_FILTER` is `difficulties: []` meaning all grades, so the chip row
  reads its lit state off `shownDifficulties`, not off `includes`.
- Glyphs on the mountain, words in the drawer — `steerOnMap` picks the form. Without a GPU
  there is no mountain to teach the shapes.
- The detail card is visually in the masthead's column and structurally nowhere near it. The
  `masthead` ref is measured as `inset.top`; a card inside it would re-project the camera on
  every run click.
- Un-boxed chrome takes the pointer one cluster at a time. A full-width
  `[&>*]:pointer-events-auto` strip would stop the bottom band of the window turning the
  mountain. Same reason the card is `pointer-events-none` except for `Clear`, and has no
  scroller.
- A button on un-boxed chrome is filled, not outlined — `border-line` on `text-rock` reads as a
  hint once the panel behind it is gone.
- `:focus-visible`'s halo must cover `.u-halo`, not only `.u-panel` descendants.

**Fixed on review**

- **The projection was held backwards.** The frame was grown past the canvas and a window
  rendered onto it, which is a crop — so the massif was magnified ×1.31 into a strip that had
  shrunk to 0.60 of its area. `lib/inset.ts` gains `viewFrame`: the clear strip is the frame,
  the canvas is the larger crop around it. Measured against three's own projection, 0.686 where
  it was 1.314.
- **`active` and `toggle` disagreed.** `active` read `length === 0 || includes`; `toggle` read
  bare `includes`, false for every chip at rest — so clicking a lit Black _selected_ advanced
  and hid the other four. `shownDifficulties` / `toggleDifficulty` moved to `lib/run-list.ts`
  so both read one thing. Switching off the last lit grade wraps back to all.
- **`u-scrim-soft` painted outside its card** — on terrain that is the point, at the head of
  the drawer it is a band across the run table. Now behind a `veiled` prop.
- **The live count vanished without a GPU.** `runCount` renders only inside `instruments`,
  which is `steerOnMap`-gated. `RunFilters` takes `announce`.
- **`transition-colors transition-opacity`** both set `transition-property`, so one snapped.

**Open**

- The drawer's own tab is not measured — a different tree at `z-30`, not a `data-chrome` box,
  so a lift plate can still land under it. Pre-existing.
- The bottom strip is not in `chromeInset`. Deliberate: the framing change was kept to one
  variable.
- `opening` is fitted to the canvas aspect, not the clear strip. It freezes in a `useState`
  initializer while `inset` is still `NO_INSET`, and the freeze is what holds the orbit clamps
  still. `fitDistance`'s 1.3 margin absorbs the difference with ~13% to spare.
- The narrow-width wrap is declared but not designed — at 900px the row reflows into something
  legible rather than something composed.
- The elevation profile's area fill is a hard-edged rectangle against its own veil.

**Gate:** 368 tests. `tests/inset.test.ts` drives a real `PerspectiveCamera` and asserts the
frame centre, the scale against a canvas the size of the clear strip, and that covering chrome
can only ever shrink the subject — which fails on the old form. Built `lake-louise.html`
carries all six fact labels, four conditions labels, the §8 sentence twice, the avalanche.ca
link and 183 `<tr>` at 80.8 KB gzipped. Checked at 1512x757 and 430x900.

**Not verified at runtime:** the no-WebGL branch.

---

## Phase 5.9 · The home page draws a run that exists ✅ done

`app/page.tsx` was a phase 0 artifact. Its masthead drew an invented massif with invented
numbers (21° / NE / 604m, captioned "Sample section") on a site whose whole claim is that its
numbers are measured, and nothing on it named the 3D terrain, the sun, the conditions, the
lifts, the filters or the shareable link that shipped in phases 2 through 5.8. Six resorts
are baked, so the figure now draws one of their runs and the page says what a resort page
actually does.

- [x] `lib/masthead.ts`: the featured run per resort, held by OSM way id, and the six
      profiles sized against one shared scale
- [x] `components/masthead-figure.tsx`: Panorama's Wild Thing through `profileGeometry`, with
      axis readouts in HTML. Replaces `components/ridgeline.tsx`, 491 lines deleted
- [x] `components/resort-index.tsx`: the six as a table, each row carrying its own profile
- [x] `app/page.tsx`: the run's five facts in the resort page's interpunct `<dl>`, one call
      to action into the run it draws, what every resort page shows, and where the numbers
      come from. Grades legend and the `npm run bake` empty state cut
- [x] `app/globals.css`: the lift-ride motion went with the lift
- [x] "Baked" is "Measured", here and on the resort page; "Untagged" is "Ungraded"
- [x] `tests/masthead.test.ts`: 32 cases over the committed artifacts

**Constraints**

- **Nothing in the figure is drawn that the bake did not measure.** The treeline rule and
  label went for that reason: no treeline elevation is baked anywhere. The lift went for the
  same one, since an invented cable over real terrain claims infrastructure that is not there.
- **The facts do not animate.** They are the page's subject, and content that fades in is
  content that is briefly missing; with `fill-mode: both` and a delay it is also content that
  stays missing if the animation never runs. Only the line moves.
- **`profileGeometry` normalises both axes, so six per-cell profiles would say nothing.**
  Each silhouette draws into a sub-box sized by its own baked `vertical_m` and `length_m`
  against the largest of the six. Steepness down the column is then a fact rather than an
  artifact of the cell.
- **No run name reaches the index.** Niseko's is `ホリデーコース` and Archivo is loaded
  latin-subset, so it would render as tofu. `Silhouette` carries no name field and a test
  asserts the absence, rather than a comment warning about it.
- **The selection is a rule's output, not a rule.** The six were picked as the deepest named
  way whose profile descends throughout. Sunshine's deepest, Delirium Dive, climbs back out
  and drew as a valley. The ids are literals and the test pins them; evaluating the rule at
  build time would instead swap a figure for a different run and say nothing.
- **No superlative on the page.** One OSM way is not one trail, and phase 1's open item has
  the Men's Downhill case, so "the biggest run at Panorama" is a claim about our extract that
  may be false about the mountain. The caption says "one named run" and the rule stays in code.
- **Counting is not computing.** `runs.runs.length` and `mountain.lifts.length` are what
  `app/resorts/[slug]/page.tsx` already does for `Marked runs` and `Lifts`. Summing 964
  `length_m` into a total distance is not counting, so the page prints no such figure. That
  number belongs to the bake and its test, or nowhere.
- `preserveAspectRatio="none"` means no `<text>` in the svg. The axis readouts are HTML, the
  way `elevation-profile.tsx` already puts its own outside the frame, and the page says the
  profile is stretched the way the resort page says `Vertical scale ×1.4`.
- The figure is in flow under the text, not behind it. `.u-scrim` holds type through its
  first 84% and feathers after, and the masthead block is taller than that, so laid over the
  figure the facts and the call to action sat in the run-out and washed out.
- Country is the column a phone loses, then Lifts; Elevation is the one a laptop loses.
  `Measured` stays at every width, because SPEC §8 wants age visible and a phone is where a
  snapshot is most likely to be read as a live feed.

**Open**

- No OG image and no favicon for `/`. Dynamic OG is phase 8; the favicon is nobody's phase.
- The eyebrow's `964 marked runs` and `86 lifts` are counted from six artifacts at build
  time. A seventh resort changes them with no test to notice.
- At 320px the index still scrolls 33px inside its own container. It fits exactly from 375px
  up, and the page itself never overflows.
- **No way to switch resorts from a resort page** except returning home. A switcher is the
  one real navigation gap in the site, and it is map chrome rather than a nav bar: it changes
  the masthead height that `lib/inset.ts` feeds the camera, and the `reserved` rects
  `mountain-labels.tsx` avoids. Its own pass, with its own framing and collision checks.
- The source link went in the footer rather than a nav bar. Two pages is not a nav, and the
  resort screen is a window the mountain fills.

**Gate:** 400 tests, up from 368. `tests/masthead.test.ts` pins way 777349974 in
`panorama/runs.json` by id, name, grade, aspect, vertical, length and sample count, pins the
other five resorts' featured ids, and asserts every one of them descends throughout, so a
re-bake that drops or reshapes one fails rather than blanking a figure. It also asserts no
silhouette carries a name and that the three new files contain no recommending language and
no build tooling. Checked by hand at 1456px: the masthead's five facts (18° / 35° / N 16° /
782m / 2.6km) and its 2452m–1671m axis match the detail card reached through the call to
action. Index measured in a real viewport at 320px (310px table in a 257px container), 375px
and 414px (fits exactly), and 640px up.

**Not verified at runtime:** `prefers-reduced-motion`, and the terrain canvas in a
screenshot. It holds a live Metal context and logs no error, but a GPU canvas does not
composite into the capture, so the resort page behind the call to action was confirmed by its
DOM and its numbers rather than by its pixels.

---

## Phase 5.10 — The phone ✅ done

SPEC §3 used to put mobile-first out of scope. It is in scope now, and the resort page was
measured rather than assumed: at 390×844 the masthead stood 339px tall and the sheet was
pinned at y=321, so the uncovered band was negative and **no pixel of terrain was on screen**.
The map-leads composition of 5.7 only composed at a laptop's width.

- [x] `SPEC.md` — §3's mobile-first non-goal replaced with "a separate mobile site"; §4 carries
      the phone view
- [x] `app/globals.css` — `@custom-variant handheld` (narrow **or** short-and-not-wide, because
      a phone on its side is 852px) and `squat` for that side
- [x] `components/resort-identity.tsx` — the six facts and the conditions fold behind `Facts`,
      339px → 89px
- [x] `lib/inset.ts` — `drawerOpen`, the tri-state rule; `run-explorer.tsx` reads a `handheld`
      `matchMedia` through `useSyncExternalStore`
- [x] `components/run-drawer.tsx` — the peek works at last (see Constraints), safe-area insets,
      a grab-bar-only peek on `squat`
- [x] `components/map-chrome.tsx` — the strip's clearance matches the peek it stands on
- [x] `components/run-table.tsx`, `lift-table.tsx` — three columns fold into a line under the
      name; the whole two-line block is the button
- [x] `components/sun-control.tsx`, `chip.tsx`, `grade-filter.tsx` — `compact` folds the word
      columns on the map
- [x] `components/terrain-scene.tsx` — `dpr` capped at 1.5 on a handheld

**Constraints**

- **`transition-transform` does not move a `translate-*` utility.** Tailwind registers
  `--tw-translate-*` with `syntax: "*"`, so `translate: var(…) var(…)` is not interpolable and
  the transition holds the start value indefinitely — the sheet's peek and the panel's retract
  both did nothing at all. The sheet is written as `transform` instead, which is why it moves
  at every width below `xl`. **The dock above `xl` still carries the live bug**: `Hide runs`
  sets the class and the panel stays put. Left alone on purpose, because this phase was not
  allowed to change desktop.
- **`handheld` is a width test _or_ a height test.** Width alone misses a phone in landscape at
  852px; height alone catches a 1280×800 laptop. The second clause is bounded by `xl`.
- `@custom-variant` takes no comma-separated media list — the block form with `@slot` per
  clause is the one that compiles. A comma silently emits a dangling selector.
- **`squat` is declared after `handheld`** because it overrides it. Variant order is source
  order.
- **Desktop is the invariant, and it was measured, not asserted.** The DOM signature and the
  boxes of the sheet, masthead, table and `h1` were captured at 1280, 1440 and 1920 before the
  first edit and compared after: geometry identical, and with `handheld:`/`squat:` tokens
  stripped, zero nodes removed or changed. Everything new is additive and hidden.
- **No datum left the table.** The folded columns return as a line inside the row's `<th>`, the
  idiom `resort-index.tsx` already used, so the served document is the same at every width
  (SPEC §9). Grade keeps its mark and folds only its word, to `sr-only` rather than away —
  a second `DifficultyMark` per row would have been a thousand hidden nodes on desktop.
- The masthead is watched by a `ResizeObserver`, so folding the facts re-frames the camera with
  no extra wiring: `inset.top` follows.

**Open**

- **The instrument strip is not in `chromeInset`.** The massif is composed against the masthead
  and the drawer only, so on a phone the bottom 188px of the frame is veiled terrain the camera
  does not know it is losing. 5.8 recorded this; a phone is where it costs the most.
- **The RSC document is ~500KB decoded**, because every run's 25m `profile` is serialized into
  `<RunExplorer>`'s props. Nothing on the table's path reads it — only the 3D overlay and the
  elevation chart do, and `runs.json` is already a static file in `public/`. Fetching it on the
  WebGL path instead would take ~220KB off every visit. Its own pass: it retypes `Run` through
  the tree and touches the desktop scene.
- `satellite.jpg` (1.5MB at Fernie, 2.1MB at Panorama) is still awaited alongside the heightmap
  before the mesh draws. Splitting them would show terrain on a quarter of the bytes.
- The sheet toggles rather than drags, still. At 320×568 the strip is 265px of a 568px window.
- The instrument row still stacks to two lines below 390px, and the date field is a native
  `type="date"` whose width is the browser's to set. Condensed on a handheld, not replaced.
- **Three columns are read-only on a phone.** Folding `Steepest`, `Aspect` and `Length` hides
  their headers, and the sort control lives in the header. The other four still sort, so the
  table is still sortable (SPEC §9); restoring these three means a phone-only sort control.
- **The `handheld` query is written out three times** — `app/globals.css`, `HANDHELD` in
  `run-explorer.tsx`, and the `<noscript>` rule in `resort-identity.tsx`. Nothing asserts that
  the three agree, and CSS cannot read the first from the other two.
- **The instrument strip appears a beat after hydration on a phone.** Its `max-xl:hidden` is
  keyed to the resolved `listOpen`, which needs `matchMedia`. The sheet's own default moved to
  CSS and no longer waits, so the terrain is there from the first paint; the strip is not.
- The opening framing is frozen at first render, so a phone that loads in portrait and turns
  keeps a portrait fit until `Reset view`.

**Gate:** 407 tests, up from 404 — `tests/inset.test.ts` pins `drawerOpen` across phone, dock,
no-GPU and a reader's own choice. Measured in real viewports at 390×844, 430×932, 375×667,
360×640, 320×568 and landscape 852×393 and 932×430: no page overflow and no table scroller at
any of them, every instrument reachable with the sheet peeked, the map 60–76% of the window
where it was 0%, and the run name's target 31×19px → 161×36px before the coarse-pointer floor.
Desktop re-measured at 1280, 1440 and 1920 against a pre-change capture: unchanged.

**Not verified at runtime:** the terrain canvas itself, which does not composite into a
screenshot; `env(safe-area-inset-*)` on real notched hardware, since a desktop Chrome resolves
every inset to 0px; and VoiceOver on the folded row, whose `<th>` now reads the name and the
three folded numbers as one cell.

---

## Phase 5.11 — Response headers ✅ done

A security review of the site as deployed found no vulnerability in the code, and no
platform-level hardening at all: the config was empty, so nothing was served with a CSP,
`nosniff`, a referrer policy or a framing rule.

- [x] `next.config.ts` — `headers()` over `/(.*)`, which Next applies ahead of the filesystem,
      so `public/` and `/_next/static` carry it too. `CONTENT_SECURITY_POLICY` and
      `SECURITY_HEADERS` are exported for the test
- [x] `tests/security-headers.test.ts` — 11 tests, weighted to what the policy must refuse
- [x] `app/api/og/[slug]/[run]/route.tsx` — the 501 placeholder no longer echoes its path params
- [x] `.github/workflows/ci.yml` — `permissions: contents: read`, actions pinned to SHAs, and an
      `npm audit --audit-level=high` step
- [x] `app/error.tsx` — a client throw now lands on a page carrying the disclaimer (SPEC §8)

**Constraints this leaves behind:**

`script-src` carries `'unsafe-inline'` and therefore mitigates no XSS. Every prerendered page
emits the RSC flight payload in nonce-less inline scripts; a nonce needs per-request HTML from
middleware, which is the prerender phases 3 and 4 were built to keep. What the policy does buy
is a bound on a compromised dependency — `connect-src 'self'` leaves it nowhere to send.

`style-src 'unsafe-inline'` is for Next's own prerendered `_global-error.html`, not for the
`<noscript>` block in `resort-identity.tsx` and not for R3F: drei writes `el.style.cssText`,
which is CSSOM and CSP-exempt.

`Strict-Transport-Security` is set here because Vercel's own differs by host: `.vercel.app` gets
`includeSubDomains; preload`, the custom domain gets a bare `max-age`. No `preload` in ours —
that is a commitment the apex owns, not this subdomain.

No `upgrade-insecure-requests`: `headers()` applies in `next dev`, where it exempts localhost
but not a LAN IP, so a phone on `http://192.168.x.x:3000` would fail the navigation itself.

`script-src` picks up `'unsafe-eval'` under `next dev` and nowhere else. `headers()` applies in
dev too, and React reconstructs server-side error stacks there with `eval`, so a policy without
it costs the stack trace on every dev error. The shipped value is what the test pins.

`worker-src 'none'` is a tripwire. drei's `<Text>` spawns a worker from a blob URL, so moving
the labels in `mountain-labels.tsx` to SDF text would need `worker-src blob:`, and the failure
would be a blank label layer rather than an error.

**Verified at runtime:** production build served on :3100 — headers present on a page, on
`public/resorts/lake-louise/heightmap.png` and on a `_next` chunk; zero CSP violations on `/`,
a resort page and a 404; terrain, overlays, drei labels, filters, sun control and the
`/api/conditions` fetch all working. At 390×844 the disclaimer is on screen without opening the
facts fold.

`treeline.aidenkopec.com` is attached and serving: a CNAME at GoDaddy to the project's
`vercel-dns` target, cert issued. `lib/site.ts` now holds the origin that `metadataBase`,
`app/robots.ts` and `app/sitemap.ts` all read, so the three cannot drift. The sitemap is built
from the manifest rather than `resorts.json` — a planned-but-unbaked resort has no page — and
dated from `baked_at` so an unchanged bake produces an unchanged sitemap.

**Still open:** the WAF rate limit on `/api/conditions/[slug]` is staged, not published.

---

## ⛳ Valid stopping point — passed

**After phase 5, with three resorts baked, this is a finished, pinnable thing.** All six are
baked. SPEC §11 is explicit: everything past here is addition, not completion. If the calendar
tightens, stop and ship rather than half-building phase 7.

---

## Phase 6 — Historical snow charts ⬜

Monthly snowfall and depth from the Open-Meteo archive, baked as JSON rather than fetched per
visitor. Closes the September problem (decision D3).

**Gate:** baked archive JSON matches a recorded API response; chart renders from a fixture.

## Phase 7 — Aspect rose + comparison view ⬜

Polar chart of run distribution by direction; two resorts side by side at identical scale.

**Gate:** rose bucket counts match `runs.json`; comparison renders both at one scale.

## Phase 8 — Dynamic OG images ⬜

`/api/og/[slug]/[run]` via `ImageResponse`, from baked data only — no network call, so a shared
link cannot fail on someone else's API.

**Gate:** route returns a valid PNG for a known run; visual check of one card.

## Phase 9 — Remaining resorts, polish, deploy ⬜

All six resorts are baked. What remains is polish and the deploy.

**Gate:** `npm run bake -- --all` green, SPEC §10 budget met, live at
`treeline.aidenkopec.com`.

---

## Scope reminder (SPEC §11)

Phases 1–5 are the two-week project. Phases 6–9 are what make this three to four weeks at
evening pace.
