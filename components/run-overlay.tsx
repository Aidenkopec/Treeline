"use client";

import { Line } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { difficultyStyle } from "@/lib/difficulty";
import { runMeshPoints } from "@/lib/terrain-mesh";
import type { Resort, Run } from "@/lib/types";

/**
 * The marked runs, drawn where they are. Only runs: the mountain around them is never
 * shaded by steepness, which would be an avalanche terrain product (SPEC §8).
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
 * Dark line either side of the coloured core. Advanced and expert are near-white, which is
 * invisible over snow; casing a line in the ground colour is how a map keeps it legible.
 */
const CASING_EXTRA = 2.5;

/**
 * The band either side of the casing on the one picked run. Width alone still loses a run
 * to its background: 105 of Lake Louise's 168 are the same near-white. Gold is outside the
 * difficulty palette, so it separates from both and cannot be misread as a grade.
 */
const HALO_EXTRA = 8;

/**
 * The picked run traced through whatever stands in front of it. The overlay is depth
 * tested, so a run on a slope tilted away is partly eaten by its own ridge, and a line
 * that is not drawn cannot be found. A thin trace says it carries on rather than ends.
 */
const GHOST_WIDTH = 1.5;

/**
 * Draw order, lowest first, per run. A run being looked at draws after every other, so it
 * reads whole across the lines it crosses rather than in the gaps between them.
 */
const LAYER = { receded: 1, hovered: 3, selected: 5 };

/**
 * How far a receded run is pulled towards the ground colour. Mixed into the colour rather
 * than applied as opacity: `Line2` overlaps quads at the joins, so a blended line beads
 * along its length. What recedes is what the reader pointed at, never pitch (SPEC §8).
 */
const RECEDED_MIX = 0.62;

/** The palette lives in app/globals.css and is read from there, never re-typed. */
function paletteColor(name: string): THREE.Color {
  return new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
}

export function RunOverlay({ resort, state }: { resort: Resort; state: RunOverlayState }) {
  const { runs, visibleIds, selectedId, hoveredId, onSelect, onHover } = state;

  const casing = useMemo(() => paletteColor("--color-shadow-deep"), []);
  // Not the casing's colour: mixing toward the ground over snow doubles contrast instead.
  const receded = useMemo(() => paletteColor("--color-rock"), []);
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

  // Width alone cannot answer "which is mine" when 105 of 168 runs are the same white.
  const picked = selectedId !== null || hoveredId !== null;

  return (
    <group>
      {lines.map(({ id, points, color }) => {
        if (points.length < 2 || !visibleIds.has(id)) return null;

        const isSelected = id === selectedId;
        const lit = isSelected || id === hoveredId;
        const width = isSelected ? SELECTED_WIDTH : id === hoveredId ? HOVER_WIDTH : CORE_WIDTH;
        const layer = isSelected ? LAYER.selected : lit ? LAYER.hovered : LAYER.receded;

        // No line writes depth, so one run's cannot reject another's where the two cross.
        if (picked && !lit) {
          // A receded run drops its casing too: the casing is most of what reads over snow.
          return (
            <Line
              color={color.clone().lerp(receded, RECEDED_MIX)}
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
            {/* Drawn through the terrain rather than against it, so a run hidden
                behind a roll still reads as carrying on. Overdrawn where visible. */}
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
            {/* A wide line and a narrow one on identical geometry z-fight, and the
                casing wins in patches, which beads the colour away. The casing is
                drawn first and writes no depth, so the core always lands on top. */}
            {/* The casing carries the pointer, being the wider of the two. R3F fires
                click only within two pixels, so a drag ending on a run still turns. */}
            <Line
              color={casing}
              depthWrite={false}
              lineWidth={width + CASING_EXTRA}
              onClick={() => onSelect(id)}
              onPointerOut={() => onHover(null)}
              onPointerOver={(event) => {
                // Without this every line under the pointer reports, and the last drawn wins.
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
