<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Treeline

A static site that renders real ski terrain in 3D from elevation data, with per-run
pitch, aspect and vertical computed from a DEM rather than read off a trail map.
`SPEC.md` is the source of truth — read it before making design or scope decisions.
`PHASES.md` tracks what is done and what is next; update it as part of the work, not after.

## Hard rules (SPEC §8)

These are safety and liability rules, not preferences. **A change to any of them is a
change to the project's risk profile and must not be made in an implementation
session.** If a task seems to require breaking one, stop and raise it.

- **No safety information, ever.** No avalanche ratings, in any form — no rating, no
  color, no icon, no summary. Avalanche information appears only as a plain outbound
  link to avalanche.ca.
- **Slope data attaches to marked runs only, never to open terrain.** Do not shade the
  mountain by steepness. "This named run averages 22°" is a fact about a patrolled run;
  "here is every steep slope on the mountain" is an avalanche terrain product.
- **Inbounds runs only, enforced at the query.** The Overpass filter takes
  `piste:type=downhill` and nothing else. `backcountry` and `skitour` are unpatrolled
  terrain and must never be baked. Enforced twice — in the query and in
  `isInboundsDownhill` — and asserted in `tests/overpass.test.ts`.
- **No recommending language.** Never "safe", "open", "recommended", "best run today",
  or any imperative to ski anything. The site presents numbers; readers draw conclusions.
- **Disclaimer on every page**, rendered globally by `components/site-footer.tsx`.
- **Not monetized.** No ads, no subscriptions — this keeps the project inside
  Open-Meteo's non-commercial terms.

## Architecture: build time vs runtime

The project is split by *when code runs*, not by language (SPEC §5).

- `scripts/` — the bake pipeline. Runs on a laptop or in a GitHub Action, never on
  Vercel and never inside a request. All the math lives here and is unit tested.
- `app/`, `components/`, `lib/` — the web app. Reads baked artifacts and renders them.
- `public/resorts/` — baked output, **committed to the repo** (SPEC §12). Generated, not
  source: do not hand-edit.

**The app must not compute run statistics.** If a number is missing, add it to the bake
and its test. Numerical work gets automated verification; visual work gets human review.

## Commands

```
npm run dev                        dev server
npm run build                      production build
npm run format                     prettier --write .
npm run lint                       eslint
npm test                           vitest
npm run typecheck                  next typegen && tsc --noEmit
npm run bake -- --check <slug>     report OSM coverage, write nothing
npm run bake -- --resort <slug>    bake one resort
npm run bake -- --all              bake every resort
```

## Design system

Tokens live in `app/globals.css` and are the single source of truth — do not hardcode
hex values in components.

- The palette is the product's own concept: warm gold (`--color-sun`) means lit, cool
  blue (`--color-shade`) means shaded, and the ground is shadowed snow, never black.
  This follows Imhof/Swisstopo relief-shading convention.
- Deliberately absent: the avalanche danger scale (green/amber/red) and any steepness
  ramp. Palette is the fastest way to accidentally imply a safety product.
- Type is one superfamily (Archivo) across three widths, the way a map labels things:
  `.u-massif` (wide, a resort), `.u-feature` (normal, a run), `.u-data` (narrow, a
  readout). The width axis is live — do not substitute a second typeface.
- Difficulty is carried by **shape** (circle / square / diamond / two diamonds) as well
  as color, so it survives being read without color (SPEC §9). Use
  `components/difficulty-mark.tsx`; never color alone.

## Accessibility

The 3D canvas conveys nothing to a screen reader and needs a GPU. The same run data must
always render as a real HTML table, with filters operating on both views. Without WebGL,
the table is the site.
