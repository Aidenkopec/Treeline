"use client";

import { Line } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { difficultyStyle } from "@/lib/difficulty";
import { runMeshPoints } from "@/lib/terrain-mesh";
import type { Resort, Run } from "@/lib/types";

/**
 * The marked runs, drawn where they are.
 *
 * Only runs. The mountain around them is never shaded by steepness — a named,
 * patrolled run with a measured pitch is a fact about that run, and a slope
 * ramp over open terrain is an avalanche terrain product (SPEC §8).
 */

export interface RunOverlayState {
  runs: Run[];
  /** Ids the current filter leaves standing. */
  visibleIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const CORE_WIDTH = 2;
const SELECTED_WIDTH = 4;

/**
 * Dark line either side of the coloured core.
 *
 * Advanced and expert are near-white by design — correct on a dark panel, and
 * invisible drawn over snow, which is most of this imagery. Casing a line in
 * the ground colour is how a map keeps a road legible over any background, and
 * it does the same here without touching the palette.
 */
const CASING_EXTRA = 2.5;

/** The palette lives in app/globals.css and is read from there, never re-typed. */
function paletteColor(name: string): THREE.Color {
  return new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
}

export function RunOverlay({ resort, state }: { resort: Resort; state: RunOverlayState }) {
  const { runs, visibleIds, selectedId, onSelect } = state;

  const casing = useMemo(() => paletteColor("--color-shadow-deep"), []);

  const lines = useMemo(
    () =>
      runs.map((run) => {
        const flat = runMeshPoints(run.profile, resort);
        const points: THREE.Vector3[] = [];
        for (let i = 0; i < flat.length; i += 3) {
          points.push(new THREE.Vector3(flat[i], flat[i + 1], flat[i + 2]));
        }
        return {
          id: run.id,
          points,
          color: paletteColor(difficultyStyle(run.difficulty).colorVar),
        };
      }),
    [runs, resort],
  );

  return (
    <group>
      {lines.map(({ id, points, color }) => {
        if (points.length < 2 || !visibleIds.has(id)) return null;
        const width = id === selectedId ? SELECTED_WIDTH : CORE_WIDTH;

        return (
          <group key={id}>
            {/* A wide line and a narrow one on identical geometry z-fight, and
                the casing wins in patches, which beads the colour away. The
                casing is drawn first and writes no depth, so the core always
                lands on top of it while both still hide behind a ridge. */}
            {/* The casing carries the click: it is the wider of the two, and a
                two-pixel core is a hard thing to hit on a mountain. R3F only
                fires click when the pointer moved two pixels or less, so a drag
                that happens to end on a run still turns the camera instead. */}
            <Line
              color={casing}
              depthWrite={false}
              lineWidth={width + CASING_EXTRA}
              onClick={() => onSelect(id)}
              points={points}
              renderOrder={1}
            />
            <Line color={color} lineWidth={width} points={points} renderOrder={2} />
          </group>
        );
      })}
    </group>
  );
}
