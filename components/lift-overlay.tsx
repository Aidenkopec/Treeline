"use client";

import { Line } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { MountainLabels } from "@/components/mountain-labels";
import { liftStyle } from "@/lib/mountain";
import { type Heightfield, lonLatToMesh } from "@/lib/terrain-mesh";
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
 *
 * The lines are here; the type over them is `mountain-labels.tsx`, which needs
 * every label at once to keep them off each other.
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

/** The palette lives in app/globals.css and is read from there, never re-typed. */
function paletteColor(name: string): THREE.Color {
  return new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
}

export function LiftOverlay({
  resort,
  state,
  field,
  receded,
}: {
  resort: Resort;
  state: MountainOverlayState;
  field: Heightfield;
  /** True while a run is being read, which is when the lifts are not the subject. */
  receded: boolean;
}) {
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

        // Pylons and hatch bars in one buffer. A big resort's lifts run to a
        // dozen towers each, which would otherwise be hundreds of separate line
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

        return { lift, line, marks };
      }),
    [lifts, resort],
  );

  const marked = useMemo(
    () =>
      places.map((place) => {
        const [x, y, z] = lonLatToMesh(place.lon, place.lat, place.surface_m, resort);
        return { place, at: new THREE.Vector3(x, y, z) };
      }),
    [places, resort],
  );

  return (
    <group>
      {drawn.map(({ lift, line, marks }) => {
        if (line.length < 2) return null;
        const lit = lift.id === hoveredLiftId;
        const width = lit ? CABLE_HOVER_WIDTH : CABLE_WIDTH;
        const order = lit ? LAYER.hovered : LAYER.lift;
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
          </group>
        );
      })}

      <MountainLabels
        field={field}
        hoveredLiftId={hoveredLiftId}
        hoveredPlaceId={hoveredPlaceId}
        lifts={drawn}
        onHoverLift={onHoverLift}
        onHoverPlace={onHoverPlace}
        places={marked}
        receded={receded}
      />
    </group>
  );
}
