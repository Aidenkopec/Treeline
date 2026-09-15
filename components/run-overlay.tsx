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
 * The band either side of the casing on the one run that has been picked.
 *
 * Width and recession together still lose a run to its background: 105 of Lake
 * Louise's 168 are the same near-white, which disappears over snow, and a green
 * run over the treed north-west side disappears the other way. Gold is outside
 * the difficulty palette entirely, so it cannot be misread as a grade, and it
 * separates from both — warm against blue-white snow, bright against dark trees.
 * It is also the palette's own word for lit (`--color-sun`), which is what a
 * picked run is.
 */
const HALO_EXTRA = 8;

/**
 * The picked run traced through whatever is standing in front of it.
 *
 * The overlay is depth tested against the terrain, so a run on a slope tilted
 * away from the camera is partly eaten by its own ridge — and a line that is not
 * drawn cannot be found, however it is styled. The camera swings round to the
 * face for exactly this reason, but a long run still dips behind a roll, and a
 * thin trace over the top says it carries on rather than ends there.
 */
const GHOST_WIDTH = 1.5;

/**
 * Draw order, lowest first, per run.
 *
 * A run being looked at draws after every other run, so it reads whole across
 * the lines it crosses rather than in the gaps between them. The picked run
 * draws after the hovered one for the same reason.
 */
const LAYER = { receded: 1, hovered: 3, selected: 5 };

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
  const halo = useMemo(() => paletteColor("--color-sun-bright"), []);
  const ghost = useMemo(() => paletteColor("--color-sun"), []);

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

        const isSelected = id === selectedId;
        const lit = isSelected || id === hoveredId;
        const width = isSelected ? SELECTED_WIDTH : id === hoveredId ? HOVER_WIDTH : CORE_WIDTH;
        const layer = isSelected ? LAYER.selected : lit ? LAYER.hovered : LAYER.receded;

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
              renderOrder={LAYER.receded}
            />
          );
        }

        return (
          <group key={id}>
            {/* Drawn through the terrain rather than against it, so the stretch
                of a run hidden behind a roll still reads as the same run
                carrying on. Under everything else the picked run draws, so
                where the run *is* visible this is simply overdrawn. */}
            {isSelected && (
              <Line
                color={ghost}
                depthTest={false}
                depthWrite={false}
                lineWidth={GHOST_WIDTH}
                points={points}
                renderOrder={layer}
              />
            )}
            {/* Under the casing, not over it: the casing is what keeps the core
                legible, and a band laid on top of it would take that away
                exactly where it is needed most. */}
            {isSelected && (
              <Line
                color={halo}
                depthWrite={false}
                lineWidth={width + CASING_EXTRA + HALO_EXTRA}
                points={points}
                renderOrder={layer + 1}
              />
            )}
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
              renderOrder={isSelected ? layer + 2 : layer}
            />
            <Line
              color={color}
              depthWrite={false}
              lineWidth={width}
              points={points}
              renderOrder={isSelected ? layer + 3 : layer + 1}
            />
          </group>
        );
      })}
    </group>
  );
}
