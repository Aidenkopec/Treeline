"use client";

import { Html, Line } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { PlaceMark } from "@/components/place-mark";
import { liftCells, liftStyle, placeCells } from "@/lib/mountain";
import { lonLatToMesh } from "@/lib/terrain-mesh";
import type { Lift, Place, Resort } from "@/lib/types";

/**
 * The lifts and the named places, drawn on the terrain.
 *
 * A lift is infrastructure, not terrain: it is drawn where it runs and carries
 * no pitch and no aspect, because the ground under a cable is not a marked run
 * (SPEC §8). Nothing here shades the mountain by anything.
 *
 * The cable is carried over the lift's real pylons — the OSM way nodes are the
 * surveyed tower positions, so the shape is measured rather than suggested.
 */

export interface MountainOverlayState {
  lifts: Lift[];
  places: Place[];
  hoveredLiftId: string | null;
  hoveredPlaceId: string | null;
  onHoverLift: (id: string | null) => void;
  onHoverPlace: (id: string | null) => void;
}

/**
 * A lift is drawn inside out from a run, and that is the whole of how the two
 * are told apart at a glance.
 *
 * A run is a coloured core inside a dark casing. A lift is a *dark* core inside
 * a *light* one. The inversion is not decoration: this drape carries snow, bare
 * rock and dark forest in one frame, and a single hairline holds up over
 * exactly one of the three. Dark-on-light reads over all of them, and it can
 * never be mistaken for a grade because no grade is drawn that way.
 */
const CABLE_WIDTH = 1.5;
const CABLE_HOVER_WIDTH = 2.4;
const CASING_EXTRA = 3;

/**
 * The cableway hatch: short bars across the line, at every mapped pylon.
 *
 * This is the standard topographic symbol for an aerial cableway — the same
 * device a map uses to draw a railway — and it is what gives a lift an identity
 * that weight and colour alone cannot. A straight dark line is a scratch on the
 * imagery; a straight dark line with bars across it is a lift, immediately, at
 * any zoom and to anyone who has ever read a map.
 *
 * Length is in ground metres and is a *symbol*, not a measurement: a real
 * crossarm is about five metres, which is a third of a pixel across a nine
 * kilometre massif. Line width is already unfaithful in the same way and for
 * the same reason.
 */
const TICK_LENGTH_M = 46;
const TICK_WIDTH = 1.3;

/**
 * Above the terrain and above an ordinary run, below one being looked at.
 *
 * The terrain mesh draws at the default 0 and writes depth; these lines write
 * none, so at 0 they tie with the ground and it paints straight over them —
 * which is a lift that is simply not there. `RunOverlay` puts an ordinary run
 * at 1 and 2, a hovered one at 3 and a picked one at 5.
 *
 * Sitting at 2.5 — over every ordinary run, under the one being read — matches
 * what a trail map does: lifts are the skeleton the runs hang off, drawn on
 * top, right up until the reader asks about one particular run.
 */
const LAYER = { lift: 2.5, hovered: 2.8 };

/** How far a place's label floats above the ground it marks, in exaggerated metres. */
const LEADER_HEIGHT_M = 100;

/**
 * Places closer together than this share a base area and will collide.
 *
 * Four of Lake Louise's lodges sit inside a hundred metres of each other at the
 * bottom of the hill, and four labels at one height is an unreadable stack.
 */
const CLUSTER_M = 400;

/**
 * How much further each label in a cluster is lifted above the last.
 *
 * Staggering the leaders is what a printed map does with a crowded corner, and
 * it costs nothing at runtime: the tier is decided once from the baked
 * positions rather than measured on screen every frame.
 */
const TIER_RISE = 1.9;

/** The palette lives in app/globals.css and is read from there, never re-typed. */
function paletteColor(name: string): THREE.Color {
  return new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
}

/** A label's plate. Matched to the canvas chrome so the map reads as one thing. */
const PLATE =
  "pointer-events-none flex select-none items-center gap-1.5 rounded border border-line/80 " +
  "bg-shadow-deep/85 px-1.5 py-0.5 whitespace-nowrap backdrop-blur-[2px]";

export function LiftOverlay({ resort, state }: { resort: Resort; state: MountainOverlayState }) {
  const { lifts, places, hoveredLiftId, hoveredPlaceId, onHoverLift, onHoverPlace } = state;

  const cable = useMemo(() => paletteColor("--color-shadow-deep"), []);
  const casing = useMemo(() => paletteColor("--color-snow"), []);
  const cableLit = useMemo(() => paletteColor("--color-sun"), []);

  const drawn = useMemo(
    () =>
      lifts.map((lift) => {
        const aerial = liftStyle(lift.kind).aerial;
        const line = lift.towers.map(({ lon, lat, ground_m, cable_m }) => {
          const [x, y, z] = lonLatToMesh(lon, lat, aerial ? cable_m : ground_m, resort);
          return new THREE.Vector3(x, y, z);
        });

        // Pylons and hatch bars in one buffer. At Niseko thirty-two lifts of a
        // dozen towers each would otherwise be hundreds of separate line
        // objects, each with its own material, against a budget of sixty frames
        // a second on integrated graphics (SPEC §10).
        const marks: THREE.Vector3[] = [];
        for (let i = 0; i < line.length; i++) {
          // The bar is square to the cable, so take the direction from whichever
          // neighbours this tower has — averaged at a bend so the hatch turns
          // with the line instead of stepping.
          const before = line[i - 1] ?? line[i];
          const after = line[i + 1] ?? line[i];
          const dx = after.x - before.x;
          const dz = after.z - before.z;
          const length = Math.hypot(dx, dz);
          if (length === 0) continue;

          // Square to the line, in the ground plane.
          const half = TICK_LENGTH_M / 2;
          const px = (-dz / length) * half;
          const pz = (dx / length) * half;
          const here = line[i];
          marks.push(
            new THREE.Vector3(here.x + px, here.y, here.z + pz),
            new THREE.Vector3(here.x - px, here.y, here.z - pz),
          );

          // The tower itself, under the bar. The terminals are buildings rather
          // than pylons, so they get a bar and no post.
          if (aerial && i > 0 && i < line.length - 1) {
            const { lon, lat, ground_m } = lift.towers[i];
            const [gx, gy, gz] = lonLatToMesh(lon, lat, ground_m, resort);
            marks.push(new THREE.Vector3(gx, gy, gz), here.clone());
          }
        }

        return { lift, line, marks, top: line[line.length - 1] };
      }),
    [lifts, resort],
  );

  /**
   * Each place, with the height its label is flown at.
   *
   * A place that shares a base area with ones already placed is lifted a tier
   * higher than the last of them, so a crowded corner reads as a stack of
   * leaders rather than as a pile of overlapping plates. Decided from the baked
   * coordinates, so nothing here measures the screen or runs per frame.
   */
  const marked = useMemo(() => {
    const out: { place: Place; foot: THREE.Vector3; head: THREE.Vector3 }[] = [];
    for (const place of places) {
      const [x, y, z] = lonLatToMesh(place.lon, place.lat, place.surface_m, resort);
      const tier = out.filter((o) => Math.hypot(o.foot.x - x, o.foot.z - z) < CLUSTER_M).length;
      const foot = new THREE.Vector3(x, y, z);
      const head = new THREE.Vector3(x, y + LEADER_HEIGHT_M * (1 + tier * TIER_RISE), z);
      out.push({ place, foot, head });
    }
    return out;
  }, [places, resort]);

  const leaders = useMemo(() => marked.flatMap(({ foot, head }) => [foot, head]), [marked]);

  return (
    <group>
      {drawn.map(({ lift, line, marks, top }) => {
        if (line.length < 2) return null;
        const lit = lift.id === hoveredLiftId;
        const width = lit ? CABLE_HOVER_WIDTH : CABLE_WIDTH;
        const order = lit ? LAYER.hovered : LAYER.lift;
        const cells = liftCells(lift);
        const ink = lit ? cableLit : cable;

        return (
          <group key={lift.id}>
            {/* The casing carries the pointer: it is the widest of the three,
                and a cable is a hard thing to hit on a mountain. */}
            <Line
              color={casing}
              depthWrite={false}
              lineWidth={width + CASING_EXTRA}
              onPointerOut={() => onHoverLift(null)}
              onPointerOver={(event) => {
                // Without this every line under the pointer reports a hover and
                // the last drawn wins rather than the one in front.
                event.stopPropagation();
                onHoverLift(lift.id);
              }}
              points={line}
              renderOrder={order}
            />
            <Line
              color={ink}
              depthWrite={false}
              lineWidth={width}
              points={line}
              raycast={() => null}
              renderOrder={order + 0.1}
            />
            {marks.length > 0 && (
              <Line
                color={ink}
                depthWrite={false}
                lineWidth={TICK_WIDTH + (lit ? 0.8 : 0)}
                points={marks}
                // Not a pointer target: the cable is the thing worth pointing
                // at, and every bar would be another object to raycast on every
                // pointer move.
                raycast={() => null}
                renderOrder={order + 0.1}
                segments
              />
            )}
            {/* Named on demand, not always. The bars across the line already
                say this is a lift — that is what the hatch is for — so a name
                on every one of thirteen is thirteen plates over the mountain
                answering a question nobody asked. Pointing at one asks it. */}
            {lit && lift.name !== null && (
              <Html center pointerEvents="none" position={top.toArray()} zIndexRange={[8, 2]}>
                <span className={`${PLATE} -translate-y-4 text-snow`}>
                  <LiftGlyph lit />
                  <span className="u-data text-[0.625rem] text-snow">{cells.name}</span>
                  <span className="u-data text-[0.625rem]">
                    {cells.vertical} · {cells.ride}
                  </span>
                </span>
              </Html>
            )}
          </group>
        );
      })}

      {leaders.length > 0 && (
        <Line
          color={casing}
          depthWrite={false}
          lineWidth={1}
          points={leaders}
          raycast={() => null}
          renderOrder={LAYER.lift}
          segments
        />
      )}

      {marked.map(({ place, head }) => {
        const lit = place.id === hoveredPlaceId;
        const cells = placeCells(place);
        return (
          // Not centred: the plate hangs off the top of its leader and runs to
          // the right, so a crowded base area stacks into a tidy column of
          // callouts sharing one left edge. Centred plates of different widths
          // clash with the tier above and below however far apart they are
          // lifted, and they overhang the canvas edge at the bottom of a hill.
          <Html key={place.id} position={head.toArray()} zIndexRange={[5, 1]}>
            <span
              className={`${PLATE} pointer-events-auto -translate-y-1/2 cursor-default transition-colors ${
                lit ? "border-sun/70 text-snow" : "text-snow/90"
              }`}
              onMouseEnter={() => onHoverPlace(place.id)}
              onMouseLeave={() => onHoverPlace(null)}
            >
              {/* The same component the list renders, so the mark on the map and
                  the mark beside the name can never drift apart. */}
              <PlaceMark kind={place.kind} size={9} />
              <span className="u-feature text-[0.6875rem] leading-none">{cells.name}</span>
              {place.ele_m !== null && (
                <span className="u-data text-[0.625rem] leading-none">{cells.elevation}</span>
              )}
            </span>
          </Html>
        );
      })}
    </group>
  );
}

/**
 * The cableway hatch again, at label size.
 *
 * A legend that travels with the thing it explains: the label carries the same
 * mark the line does, so the bars across a line on the mountain are learned
 * once and read everywhere after.
 */
function LiftGlyph({ lit }: { lit: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={lit ? "text-sun" : "text-rock-dim"}
      fill="none"
      height="8"
      stroke="currentColor"
      strokeWidth="1.2"
      viewBox="0 0 12 8"
      width="12"
    >
      <path d="M0.5 4h11" />
      <path d="M3 1.8v4.4M6 1.8v4.4M9 1.8v4.4" />
    </svg>
  );
}
