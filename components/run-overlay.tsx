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
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

const CORE_WIDTH = 2;
const RECEDED_WIDTH = 1.5;
const HOVER_WIDTH = 3;
const SELECTED_WIDTH = 5;

/**
 * Dark line either side of the coloured core.
 *
 * Advanced and expert are near-white by design — correct on a dark panel, and
 * invisible drawn over snow, which is most of this imagery. Casing a line in
 * the ground colour is how a map keeps a road legible over any background, and
 * it does the same here without touching the palette.
 */
const CASING_EXTRA = 2.5;

/**
 * How far a receded run is pulled towards the ground colour. Tuned by eye.
 *
 * Mixed into the colour rather than applied as opacity: `Line2` draws a
 * polyline as one quad per segment, and consecutive quads overlap at the joins.
 * Blended, every join composites twice and the line beads along its length —
 * the phase-3 artefact, back by another route. Opaque lines overdraw instead,
 * which is the same pixel twice.
 *
 * What recedes is decided by what the reader has pointed at, and by nothing
 * else. Fading runs by pitch instead would shade the mountain by steepness with
 * extra steps, which is the thing SPEC §8 forbids.
 */
const RECEDED_MIX = 0.62;

/** The palette lives in app/globals.css and is read from there, never re-typed. */
function paletteColor(name: string): THREE.Color {
  return new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
}

export function RunOverlay({ resort, state }: { resort: Resort; state: RunOverlayState }) {
  const { runs, visibleIds, selectedId, hoveredId, onSelect, onHover } = state;

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

  // Width alone cannot answer "which of these is mine" — 105 of Lake Louise's
  // 168 runs are the same near-white, and two extra pixels among them is not a
  // signal. Once one run is picked out the rest step back instead.
  const picked = selectedId !== null || hoveredId !== null;

  return (
    <group>
      {lines.map(({ id, points, color }) => {
        if (points.length < 2 || !visibleIds.has(id)) return null;

        const lit = id === selectedId || id === hoveredId;
        const width =
          id === selectedId ? SELECTED_WIDTH : id === hoveredId ? HOVER_WIDTH : CORE_WIDTH;

        // No line writes depth. The terrain already has, so a run still hides
        // behind a ridge; what this avoids is one run's depth rejecting
        // another's where the two cross, which is a real risk now that the run
        // being looked at deliberately draws after all the others.
        if (picked && !lit) {
          // A receded run drops its casing as well as its colour. The casing is
          // most of what makes a line read boldly over snow, so losing it is
          // half the step back.
          return (
            <Line
              color={color.clone().lerp(casing, RECEDED_MIX)}
              depthWrite={false}
              key={id}
              lineWidth={RECEDED_WIDTH}
              onClick={() => onSelect(id)}
              onPointerOut={() => onHover(null)}
              onPointerOver={(event) => {
                event.stopPropagation();
                onHover(id);
              }}
              points={points}
              renderOrder={1}
            />
          );
        }

        return (
          <group key={id}>
            {/* A wide line and a narrow one on identical geometry z-fight, and
                the casing wins in patches, which beads the colour away. The
                casing is drawn first and writes no depth, so the core always
                lands on top of it. When a run is being looked at both of its
                lines draw after every other run's, so it reads whole across
                the lines it crosses rather than in the gaps between them. */}
            {/* The casing carries the pointer: it is the wider of the two, and a
                two-pixel core is a hard thing to hit on a mountain. R3F only
                fires click when the pointer moved two pixels or less, so a drag
                that happens to end on a run still turns the camera instead. */}
            <Line
              color={casing}
              depthWrite={false}
              lineWidth={width + CASING_EXTRA}
              onClick={() => onSelect(id)}
              onPointerOut={() => onHover(null)}
              onPointerOver={(event) => {
                // Without this every line under the pointer reports a hover and
                // the last one drawn wins, not the one in front.
                event.stopPropagation();
                onHover(id);
              }}
              points={points}
              renderOrder={lit ? 3 : 1}
            />
            <Line
              color={color}
              depthWrite={false}
              lineWidth={width}
              points={points}
              renderOrder={lit ? 4 : 2}
            />
          </group>
        );
      })}
    </group>
  );
}
