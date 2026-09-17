"use client";

import { Line } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { MountainLabels } from "@/components/mountain-labels";
import type { Rect } from "@/lib/label-layout";
import { liftStyle } from "@/lib/mountain";
import { type Heightfield, lonLatToMesh } from "@/lib/terrain-mesh";
import type { Lift, Place, Resort } from "@/lib/types";

/**
 * The lifts and the named places, drawn on the terrain. A lift is infrastructure: drawn
 * where it runs, carrying no pitch and no aspect, because the ground under a cable is not
 * a marked run (SPEC §8). The cable rides the OSM way nodes, which are surveyed towers.
 */

export interface MountainOverlayState {
  lifts: Lift[];
  places: Place[];
  hoveredLiftId: string | null;
  hoveredPlaceId: string | null;
  onHoverLift: (id: string | null) => void;
  onHoverPlace: (id: string | null) => void;
  /**
   * Where the page's own controls are standing, in canvas pixels. The label pass treats
   * these as plates it cannot move. Referentially stable between measurements, because a
   * new array is what tells the pass to run again.
   */
  reserved: Rect[];
}

/**
 * A lift is drawn inside out from a run: a dark core in a light casing, where a run is a
 * coloured core in a dark one. The drape carries snow, rock and forest in one frame and
 * dark-on-light reads over all three; no grade is drawn that way, so it cannot be one.
 */
const CABLE_WIDTH = 1.5;
const CABLE_HOVER_WIDTH = 2.4;
const CASING_EXTRA = 3;

/**
 * The cableway hatch: short bars across the line at every mapped pylon, the standard
 * topographic symbol. Length is in ground metres and is a symbol, not a measurement: a
 * real crossarm is five metres, a third of a pixel across a nine kilometre massif.
 */
const TICK_LENGTH_M = 46;
const TICK_WIDTH = 1.3;

/**
 * Above the terrain and above an ordinary run, below one being looked at. These lines
 * write no depth, so at 0 they tie with the ground and it paints over them. `RunOverlay`
 * puts an ordinary run at 1 and 2, a hovered one at 3 and a picked one at 5.
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
  const { lifts, places, hoveredLiftId, hoveredPlaceId, onHoverLift, onHoverPlace, reserved } =
    state;

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

        // Pylons and bars in one buffer: a dozen towers a lift would be hundreds of objects.
        const marks: THREE.Vector3[] = [];
        for (let i = 0; i < line.length; i++) {
          // Square to the cable, averaged at a bend so the hatch turns instead of stepping.
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

          // Terminals are buildings rather than pylons, so they get a bar and no post.
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
                // Without this every line under the pointer reports, and the last drawn wins.
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
                // Not a pointer target: every bar would be another object to raycast.
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
        reserved={reserved}
      />
    </group>
  );
}
