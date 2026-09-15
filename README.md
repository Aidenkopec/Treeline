# Treeline

Resort trail maps are stylized 2D panoramas. They flatten the mountain, hide how steep
anything actually is, and say nothing about which direction a run faces.

Treeline renders the real mountain in 3D from elevation data, draws the marked runs on
it in their true positions, and gives each one its actual numbers — pitch, aspect,
vertical, length — computed from the elevation model rather than read off a trail map.

Six resorts at launch. The pipeline that produces them works anywhere on earth.

See [SPEC.md](./SPEC.md) for the full design, scope and the rules the project holds to,
and [PHASES.md](./PHASES.md) for what is built, what is in progress and what is next.

## Getting started

```bash
npm install
npm run dev
```

Nothing is rendered until a resort has been baked. Check a resort's OpenStreetMap
coverage first, then bake it:

```bash
npm run bake -- --check lake-louise      # report coverage, write nothing
npm run bake -- --resort lake-louise     # download, compute, emit artifacts
```

A bake takes minutes — dozens of tile downloads plus a slow, rate-limited Overpass
query. It runs on a laptop or in a scheduled GitHub Action and writes artifacts that are
committed to the repo. It never runs on Vercel and never runs inside a request.

## How it is put together

The project splits by _when_ code runs rather than by language:

|                             |                                                                                                                                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/`                  | The bake pipeline. Resolves resort bounds from OSM, downloads and stitches elevation and imagery tiles, samples runs against the DEM, computes slope and aspect by Horn's method. All the math, all unit tested. |
| `app/` `components/` `lib/` | The web app. Next.js App Router, React Three Fiber for the terrain, inline SVG for the charts. Reads baked artifacts and renders them.                                                                           |
| `public/resorts/`           | Baked output — heightmaps, satellite textures, run data. Generated, and committed.                                                                                                                               |

There is no database: a manifest plus static assets. The only runtime server code is two
route handlers — one proxying live conditions from Open-Meteo, one rendering share images.

## Development

```bash
npm test          # vitest
npm run typecheck # tsc --noEmit
npm run lint      # eslint
npm run build     # production build
```

## Safety and scope

Treeline covers marked, inbounds runs at lift-served resorts. It is not a backcountry
planning tool, and it carries no safety information: no avalanche ratings, no
steepness shading of open terrain, and no language that recommends skiing anything.
Those exclusions are deliberate and documented in SPEC §8, which is worth reading before
proposing a feature.

Terrain data is approximate, derived from 30m elevation models. Not for navigation or
safety decisions. Check [avalanche.ca](https://avalanche.ca) and resort reports before
skiing.

## Attribution

Elevation from [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/).
Winter surface rendered from Esri World Imagery. Runs and resort boundaries from
[OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, ODbL.
Weather from [Open-Meteo](https://open-meteo.com).
