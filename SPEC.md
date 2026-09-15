# Treeline — design spec

**Status:** draft, pending review
**Date:** 2026-09-15
**Owner:** Aiden Kopec

---

## 1. The problem

Resort trail maps are stylized 2D panoramas. They flatten the mountain, hide how
steep anything actually is, and say nothing about which direction a run faces. A
skier arriving somewhere unfamiliar has no way to answer the questions that
decide a good day:

- How steep is this run, really?
- Which way does it face — will it hold powder or be baked to crust by 2pm?
- Which runs are in the sun right now?
- How much vertical do I get?

Treeline answers those on the real mountain, in 3D, before you buy a ticket.

## 2. What it is

A static site. Pick a resort, see its actual terrain rendered from elevation
data with satellite imagery draped over it. Ski runs are drawn on the surface in
their real positions, colored by difficulty. Click a run and get its true
numbers — pitch, aspect, vertical, length — computed from the elevation model,
not from a trail map. A conditions strip shows snow and weather. A sun slider
shows which slopes are lit at any hour of any day.

Six resorts at launch. The pipeline that produces them works anywhere on earth.

## 3. Non-goals

Explicitly out of scope for v1. Each of these is a plausible next feature and
none of them is in this version.

- **Avalanche ratings, or any safety information.** See §8. This is a hard
  exclusion on liability grounds, not a scheduling decision, and it does not
  come back in a later version without legal advice first.
- **Lift status, open/closed runs, grooming reports.** There is no standard API.
  It is per-resort scraping that breaks every season. This is the single most
  tempting feature and it would consume the entire budget.
- **User accounts, saved days, tracked runs, social features.**
- **All 72 resorts in the OSM index.** Asset weight makes this impractical on a
  static host.
- **Runtime resort search.** Resorts are baked ahead of time, not fetched on
  demand.
- **Mobile-first design.** The site must not be broken on a phone; it is not
  designed for one.
- **Route planning between runs**, lift-aware pathfinding, or "plan my day".

## 4. Scope — v1

- Six resorts baked: Lake Louise, Sunshine Village, Panorama, Kimberley, Fernie,
  Niseko. The first five are home hills; Niseko demonstrates the pipeline is not
  hardcoded to Canada.
- 3D terrain with satellite imagery draped over it
- Ski runs drawn on the terrain, colored by difficulty
- Per-run stats panel: average pitch, steepest pitch, aspect, vertical drop,
  length, name, difficulty
- Filter runs by aspect, difficulty and minimum vertical
- Sun/shade simulation by date and time of day
- Conditions strip: snowfall, snow depth, temperature, wind
- An outbound link to avalanche.ca, presented as a link and never as a rating
- Camera: cinematic fly-through by default, grab to take manual control
- First-person run camera: ride the selected run's actual polyline at skier speed
- Elevation profile per run, drawn from the samples already taken to compute pitch
- Aspect rose: polar chart of how a resort's runs are distributed by direction
- Comparison view: two resorts side by side at identical scale
- Historical snow: monthly snowfall and depth for past seasons, from the
  Open-Meteo archive
- Dynamic Open Graph images per run and per resort
- Shareable URL per resort and per run
- Accessible fallback: the same run data as an HTML table
- Attribution and safety disclaimer

## 5. Architecture

One TypeScript project, split by _when the code runs_ rather than by language.

```
BUILD TIME (laptop or GitHub Action)     RUNTIME (Vercel)
  scripts/bake.ts                          app/  (Next.js App Router)
  resorts.json  ──────────┐
    ↓ Overpass            │              public/resorts/<slug>/
    ↓ AWS terrarium       ├──emits──→      heightmap.png
    ↓ Esri imagery        │                satellite.jpg
    ↓ slope/aspect math   │                runs.json
                          │              public/resorts/manifest.json
                          │                        ↓
                          └────────read at build───┘

                                         app/api/conditions/[slug]
                                           ↓ Open-Meteo (the only
                                             outbound call at runtime)
                                         app/api/og/[slug]/[run]
                                           ↓ ImageResponse, from baked data
```

**The bake pipeline is where all the math lives, and it is fully testable.**
The web app reads pre-computed artifacts and renders them. This split is
deliberate: numerical work gets automated verification, visual work gets human
review, and neither pretends to be the other.

**No database.** A manifest plus static assets. The only runtime server code is
two route handlers: one proxying live conditions, one rendering share images.

### 5.1 Bake pipeline (TypeScript, build-time only)

This never runs on Vercel and never runs inside a request. It runs on a laptop
or in a scheduled GitHub Action, and writes files that are committed to the
repo. A bake takes minutes — dozens of tile downloads plus a slow, rate-limited
Overpass query — which is precisely why it cannot be a runtime call.

`npm run bake -- --resort <slug>` does:

1. Resolve the resort's bounding box from OSM (`landuse=winter_sports`)
2. Download terrarium elevation tiles covering the box, stitch, decode:
   `elevation_m = (R * 256 + G + B / 256) - 32768`
3. Download Esri World Imagery tiles for the same box, stitch
4. Query Overpass for `piste:type=downhill` ways in the box. **Only
   `downhill`.** OSM also carries `piste:type=backcountry` and
   `piste:type=skitour`; baking those would put unpatrolled terrain into a site
   that states it covers inbounds runs. The filter is a safety rule, not a
   scoping preference — see §8.
5. Sample elevation along each run's polyline from the DEM
6. Compute per-run derived stats (§6)
7. Emit `heightmap.png`, `satellite.jpg`, `runs.json`, manifest entry

`npm run bake -- --check <slug>` reports data coverage without writing anything,
so a resort with poor OSM coverage is caught before it is baked.

Implementation: `scripts/bake.ts`, executed with `tsx`. Elevation and imagery
tiles decode through `sharp`; the heightmap lives in a `Float32Array` and slope
and aspect are computed over it directly. No GDAL, no Python, no native
toolchain beyond `sharp`'s prebuilt binary.

### 5.2 Web app (Next.js + TypeScript)

- Next.js App Router, deployed on Vercel
- React Three Fiber + drei for the 3D scene
- Terrain: plane geometry displaced by the heightmap, satellite texture draped
- Runs: line geometry projected onto the terrain surface, offset slightly to
  avoid z-fighting
- Sun: directional light positioned from `suncalc` given lat/lon/date/time
- First-person camera: the run's polyline becomes a camera path, eased to a
  plausible descent speed, with the look-ahead target a few samples down the line
- Charts (elevation profile, aspect rose, snow history) are inline SVG. No chart
  library — the shapes are simple and a dependency is not worth the weight.
- Two route handlers:
  - `/api/conditions/[slug]` — current weather from Open-Meteo, cache headers
  - `/api/og/[slug]/[run]` — dynamic Open Graph image via `ImageResponse`,
    rendering run name, difficulty, pitch, aspect, vertical and the elevation
    profile
- Historical snow ships as baked JSON, not a runtime call. The archive does not
  change, so there is no reason to fetch it per visitor.

### 5.3 One language, one toolchain

The meaningful boundary in this project is build-time versus runtime, not
Python versus TypeScript. That boundary holds regardless of language: the bake
is minutes of network and raster work, the app is a static site that reads its
output.

Given the boundary exists either way, the bake is TypeScript too. One
`package.json`, one test runner, one CI configuration. A reviewer opening the
repo sees a single language, which matches the work this project is meant to
demonstrate.

`numpy` would make the gradient math more concise than typed arrays do. That is
a real but small advantage, and it does not pay for a second toolchain — two
dependency stories, two test runners, and two environments to set up in every
development session.

## 6. Derived run data

This is the part no trail map gives you, and the reason the project exists.

For each run, sampled along its polyline against the DEM:

| Field           | Definition                                                                              |
| --------------- | --------------------------------------------------------------------------------------- |
| `vertical_m`    | max elevation − min elevation                                                           |
| `length_m`      | 3D path length, not map distance                                                        |
| `pitch_avg_deg` | mean slope over sampled segments                                                        |
| `pitch_max_deg` | steepest sustained segment (windowed, not a single spike)                               |
| `aspect_deg`    | compass direction the run faces, 0–360                                                  |
| `aspect_label`  | N / NE / E / SE / S / SW / W / NW                                                       |
| `difficulty`    | from OSM `piste:difficulty`, null when untagged                                         |
| `profile`       | elevation samples along the run, for the profile chart and the first-person camera path |

Slope and aspect come from a 3×3 gradient over the heightmap (Horn's method,
the standard used by GDAL and ArcGIS), computed over a `Float32Array`.
`pitch_max` uses a sliding window so one noisy DEM cell cannot report a cliff
that isn't there.

**Verification:** pitch and aspect for two hand-checked runs at Lake Louise are
committed as golden values. The test asserts to a tolerance, not exactly — the
DEM is 30m data and precision claims beyond that would be false.

## 7. Data sources

All verified live and keyless on 2026-09-15.

| Source                        | Use                                     | Auth | Terms                      |
| ----------------------------- | --------------------------------------- | ---- | -------------------------- |
| AWS Terrain Tiles (terrarium) | elevation                               | none | attribution required       |
| Esri World Imagery            | satellite texture                       | none | attribution required       |
| OpenStreetMap via Overpass    | runs, resort index                      | none | ODbL, attribution required |
| Open-Meteo forecast           | current snow, temp, wind                | none | free for non-commercial    |
| Open-Meteo archive            | historical snowfall and depth by season | none | free for non-commercial    |

Overpass is slow and rate-limited. It is only ever called at bake time, never by
a visitor.

Avalanche Canada was evaluated and deliberately rejected. See §8.

## 8. Legal and safety

The project publishes public geographic data — terrain shape, slope angle,
aspect — with attribution and no advice. That is an ordinary and
well-precedented thing to publish. The rules below are what keep it there.

**No safety information, ever.** Avalanche ratings are excluded by design, not
by schedule. Three reasons:

1. Avalanche Canada bulletins forecast _backcountry_ hazard. Every run here is
   inbounds resort terrain where hazard is actively controlled by patrol.
   Displaying a backcountry rating beside inbounds runs is misleading in both
   directions, and several of these resorts have slackcountry access directly
   off marked terrain.
2. Republishing a rating inside this UI makes its presentation this project's
   responsibility — currency, region matching, and whether the layout implies it
   covers terrain it does not.
3. It is the only data type on the list that connects to a fatality.

Avalanche information appears as an outbound link to avalanche.ca and in no
other form. No rating, no color, no icon, no summary.

**Slope data attaches to marked runs only. Never to open terrain.** Shading the
whole mountain by steepness — the 30–45° band highlighted — is exactly what
backcountry avalanche-terrain tools do, and it would reintroduce every risk in
this section without an avalanche API anywhere in sight. It is the obvious next
step once a heightmap exists, which is why it is written down as forbidden.
"This named run averages 22°" is a fact about a patrolled run. "Here is every
steep slope on the mountain" is an avalanche terrain product.

**Inbounds runs only, enforced at the query.** The Overpass filter takes
`piste:type=downhill` and nothing else. `backcountry` and `skitour` are
unpatrolled terrain and must never be baked. See §5.1 step 4.

**No recommending language.** Never "safe", "open", "recommended", "best run
today", or any imperative to ski anything. The site presents numbers; readers
draw conclusions. Data framed as advice changes what this is.

**Framed as inbounds terrain.** A visible statement that the site covers marked
resort runs and is not a backcountry planning tool.

**Disclaimer, on every page:** "Terrain data is approximate, derived from 30m
elevation models. Not for navigation or safety decisions. Check avalanche.ca and
resort reports before skiing."

**Provenance and age, visible:** data source and the date each resort was last
baked, so the site reads as a dated snapshot of public data rather than an
authority.

**Not monetized.** No ads, no subscriptions, no paid tier. This keeps the
project inside Open-Meteo's non-commercial terms and keeps its posture that of a
hobby project.

**Attribution:** OpenStreetMap contributors (ODbL), Esri World Imagery, AWS
Terrain Tiles, Open-Meteo.

This section is not a style preference. A change to any rule here is a change to
the project's risk profile and should not be made in an implementation session.

## 9. Accessibility

The 3D canvas conveys nothing to a screen reader and requires a GPU. Alongside
it, the same run data renders as a sortable HTML table — real content, not an
`aria-label`. Filters operate on both views. Without WebGL, the table is the
site.

## 10. Performance budget

| Metric                     | Target                       |
| -------------------------- | ---------------------------- |
| Initial payload per resort | < 5 MB                       |
| Time to first render       | < 2.5s on broadband          |
| Frame rate                 | 60fps on integrated graphics |
| Total repo assets          | < 40 MB for six resorts      |

Heightmaps are PNG carrying elevation in RGB exactly as the terrarium source encodes
it, satellite textures JPEG at quality tuned per resort. The encoding is RGB rather
than 16-bit greyscale because a browser decodes every PNG to 8 bits per channel: a
greyscale heightmap would reach the renderer quantised to 256 elevation levels.
If a resort exceeds budget, its resolution drops rather than the budget moving.

## 11. Phases

Each phase ends working, committed and deployable. Each runs in its own Claude
Code session with its own verification gate.

| #     | Deliverable                                                       | Check                                                                                                                                                                 |
| ----- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Bake pipeline, Lake Louise only                                   | vitest: fixture tile decodes to known elevations; golden pitch/aspect within tolerance; `downhill`-only filter asserted against a fixture containing backcountry ways |
| 2     | Next.js app renders that terrain                                  | screenshot, human review                                                                                                                                              |
| 3     | Run overlay + stats panel + filters + elevation profile           | stats in UI match `runs.json`; filter unit tests; profile chart renders from fixture data                                                                             |
| 4     | Conditions route handler                                          | tests against recorded Open-Meteo fixtures, including an API-down case                                                                                                |
| 5     | Sun/shade + first-person run camera                               | known sunrise/sunset asserted for a fixed date and latitude; camera path stays on the polyline within tolerance                                                       |
| **—** | **Valid stopping point.** Three resorts, core experience complete | —                                                                                                                                                                     |
| 6     | Historical snow charts                                            | baked archive JSON matches a recorded API response; chart renders from fixture                                                                                        |
| 7     | Aspect rose + comparison view                                     | rose bucket counts match `runs.json`; comparison renders both resorts at one scale                                                                                    |
| 8     | Dynamic OG images                                                 | `ImageResponse` route returns a valid PNG for a known run; visual check of one card                                                                                   |
| 9     | Remaining resorts, polish, deploy                                 | `npm run bake -- --all` green, budget met, live URL                                                                                                                   |

Phase 1 produces real artifacts before a single pixel is drawn. If the project
stalls at phase 2, a working data pipeline still exists.

**On scope.** Phases 1–5 are the two-week project. Phases 6–9 are the reason
this is now realistically three to four weeks at evening pace. The marked
stopping point after phase 5 is a real one: three resorts with terrain, runs,
stats, filters, sun and a first-person camera is a finished, pinnable thing.
Everything after it is addition, not completion. If the calendar tightens, stop
there and ship rather than half-building phase 7.

## 12. Maintenance

A scheduled GitHub Action re-bakes monthly, gated by the test suite, and commits
changed artifacts — the same pattern as the profile card repo. OSM edits and new
runs land without manual work.

## 13. Risks

| Risk                                       | Mitigation                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| OSM coverage is poor at a chosen resort    | `--check` mode reports coverage before baking; swap the resort               |
| Terrain looks flat and unimpressive        | Vertical exaggeration is configurable per resort; tune by eye in phase 2     |
| It is September — snow values are all zero | See open decision D3                                                         |
| Web Mercator tile math eats a day          | Isolated in one module with its own tests; the known-hard part, budgeted for |
| Asset weight grows past a static host      | Per-resort resolution is a config value, not a constant                      |

## 14. Open decisions

- **D1.** Is derived data (pitch/aspect/sun) the core of the product, with the
  fly-through as presentation? This spec assumes yes.
- **D2.** Six resorts in v1, or three with the rest added after? This spec
  assumes six, phased so that three is a valid stopping point.
- **D3.** ~~September problem.~~ **Closed.** Historical snow charts (§4, phase 6)
  give the conditions area real content year-round. Past weather is a matter of
  record rather than a forecast, so it carries none of the §8 concerns. No
  "last season" workaround is needed.
- **D4.** ~~Name.~~ **Closed: Treeline.** The treeline is a fixed terrain
  feature — the elevation where trees stop and the alpine begins. It matches
  what this project actually holds: the permanent shape of a mountain, not
  today's conditions. Repo `treeline`, displayed as Treeline.
- **D5.** ~~Domain.~~ **Closed: `treeline.aidenkopec.com`.** A subdomain of a
  domain already owned. It costs nothing, it is a single DNS record on Vercel,
  and every shared link drives traffic to Aiden's own name rather than to an
  unrelated brand — which is the point, while this is a portfolio piece. Buying
  a standalone domain stays available later if the project outgrows that.

## 15. Definition of done

Six resorts live at a public URL. A visitor who has never skied Revelstoke can
pick a resort, filter to north-facing blacks over 400m vertical, click one, see
its real pitch and aspect, check whether it will be in the sun at 2pm, and read
today's snow and temperature — then send that exact view to a friend as a link.

## 16. Deferred

Real ideas, deliberately not in v1. Recorded so they are not rediscovered as
gaps.

- **Command palette** (`⌘K`) to jump between resorts and runs
- **Export view as an image**, for people who share wallpapers
- **Contour / topo shading toggle** as an alternative to satellite imagery,
  applied to the base map only and never as a steepness product (§8)
- **More resorts** from the OSM index, gated by asset budget (§10)
- **Metric / imperial toggle**, if anyone outside Canada ever uses this

Rejected outright, with reasons in §8: avalanche ratings, slope-angle shading of
open terrain, backcountry and skitour pistes, lift status, and anything that
ranks or recommends runs.
