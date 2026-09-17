"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { PlaceMark } from "@/components/place-mark";
import { clusterPoints, placePlates, type PlateCandidate, type Rect } from "@/lib/label-layout";
import { liftCells, placeCells } from "@/lib/mountain";
import { type Heightfield, isVisibleFrom } from "@/lib/terrain-mesh";
import type { Lift, Place } from "@/lib/types";

/**
 * Everything on the mountain that is written rather than drawn. Split from the cables it
 * labels because one pass has to hold every candidate at once: a lift's name must not land
 * on a lodge. Lifts and summits are named unasked; everything else names itself on hover.
 */

export interface DrawnLift {
  lift: Lift;
  /** The cable, bottom to top, one point per surveyed pylon. */
  line: THREE.Vector3[];
}

export interface MarkedPlace {
  place: Place;
  at: THREE.Vector3;
}

/**
 * How long between passes, at most. Between them drei goes on tracking the points, so only
 * the decisions are stale, and only while the camera swings. A pass is skipped outright
 * when the camera has not moved, so this is the rate during a drag and nothing at rest.
 */
const PASS_MS = 60;

/** A label this close to the edge is half cut off, which reads as a glitch. */
const EDGE_MARGIN_PX = 10;

/** Places closer together than this on screen become one mark. */
const CLUSTER_PX = 34;

const MARK_PX = 22;
const PLATE_HEIGHT_PX = 18;

/** Clearance between a plate and the cable it names. */
const CABLE_GAP_PX = 7;

/** A lift shorter than this on screen has no room for a name along it. */
const MIN_LIFT_PX = 56;

/**
 * A plate's width, estimated from its text rather than measured, because measuring forces
 * a reflow inside the render loop. Calibrated on the lift plate: `.u-data`, one glyph, one
 * gap. A peak plate is wider, so its footprint comes out tighter than it really is.
 */
const CHAR_PX = 4.8;
const PLATE_CHROME_PX = 38;

function plateWidth(text: string): number {
  return text.length * CHAR_PX + PLATE_CHROME_PX;
}

/**
 * Directions a plate may sit in from the thing it names. Eight, not a free angle, so a
 * plate holds position while the mountain turns under it and snaps once at a boundary.
 */
const COMPASS = 8;

function compassSide(x: number, y: number): number {
  const step = Math.round((Math.atan2(y, x) / (2 * Math.PI)) * COMPASS);
  return ((step % COMPASS) + COMPASS) % COMPASS;
}

/** Where a plate's centre sits, given the side it took and how big it is. */
function plateOffset(side: number, width: number): { x: number; y: number } {
  const angle = (side / COMPASS) * 2 * Math.PI;
  const [dx, dy] = [Math.cos(angle), Math.sin(angle)];
  // The plate's half-extent along the push direction, so it clears by width or by height.
  const reach = CABLE_GAP_PX + (Math.abs(dx) * width) / 2 + (Math.abs(dy) * PLATE_HEIGHT_PX) / 2;
  return { x: dx * reach, y: dy * reach };
}

/** Rungs a summit's name climbs when another summit already holds the first. */
const PEAK_OFFSETS = [
  { x: 0, y: 0 },
  { x: 0, y: -(PLATE_HEIGHT_PX + 5) },
  { x: 0, y: PLATE_HEIGHT_PX + 5 },
];

/**
 * Where along a cable a name is tried, as a fraction of the visible run of it. The middle
 * first, then outward in pairs, because crowded names slide along their lines rather than
 * drop. Fractions rather than towers: two adjacent pylons are a few pixels apart.
 */
const ALONG_CABLE = [0.5, 0.34, 0.66, 0.2, 0.8];

interface Layout {
  lifts: { id: string; tower: number; side: number }[];
  peaks: { id: string; offset: number }[];
  marks: { anchorId: string; ids: string[] }[];
}

const NOTHING: Layout = { lifts: [], peaks: [], marks: [] };

/** What has to change before the labels are worth re-rendering. */
function signature(layout: Layout): string {
  return [
    layout.lifts.map((l) => `${l.id}@${l.tower}/${l.side}`).join(","),
    layout.peaks.map((p) => `${p.id}/${p.offset}`).join(","),
    layout.marks.map((m) => `${m.anchorId}:${m.ids.join("+")}`).join(","),
  ].join(";");
}

/** The plate chrome, matched to the canvas so the map reads as one thing. */
const PLATE =
  "flex select-none items-center gap-1.5 rounded border bg-shadow-deep/85 px-1.5 py-0.5 " +
  "whitespace-nowrap backdrop-blur-[2px]";

export function MountainLabels({
  lifts,
  places,
  field,
  receded,
  hoveredLiftId,
  hoveredPlaceId,
  onHoverLift,
  onHoverPlace,
  reserved,
}: {
  lifts: DrawnLift[];
  places: MarkedPlace[];
  field: Heightfield;
  /** True while a run is being read. The run is the subject then, not the lifts. */
  receded: boolean;
  hoveredLiftId: string | null;
  hoveredPlaceId: string | null;
  onHoverLift: (id: string | null) => void;
  onHoverPlace: (id: string | null) => void;
  /** Screen space the page's controls have already taken (SPEC §9 chrome). */
  reserved: Rect[];
}) {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  const liftById = useMemo(() => new Map(lifts.map((l) => [l.lift.id, l])), [lifts]);
  const placeById = useMemo(() => new Map(places.map((p) => [p.place.id, p])), [places]);

  // Biggest first, so where two names cannot both be drawn the longer lift keeps its own.
  const ranked = useMemo(
    () => [...lifts].sort((a, b) => b.lift.vertical_m - a.lift.vertical_m),
    [lifts],
  );

  const [layout, setLayout] = useState<Layout>(NOTHING);
  const drawn = useRef(signature(NOTHING));
  const passedAt = useRef(0);
  const from = useRef<THREE.Matrix4 | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // A camera that has not moved cannot change the answer; clearing this asks for a pass.
  useEffect(() => {
    from.current = null;
  }, [size.width, size.height, ranked, places, reserved]);

  useFrame(() => {
    const now = performance.now();
    if (now - passedAt.current < PASS_MS) return;
    if (from.current?.equals(camera.matrixWorld)) return;
    passedAt.current = now;
    from.current = camera.matrixWorld.clone();

    const next = decide(ranked, places, field, camera, size.width, size.height, reserved);
    const key = signature(next);
    // Only a decision change is worth a render: between passes drei tracks without React.
    if (key === drawn.current) return;
    drawn.current = key;
    setLayout(next);
  });

  const dim = receded ? "opacity-40" : "";

  return (
    <>
      {layout.lifts.map(({ id, tower, side }) => {
        const drawnLift = liftById.get(id);
        if (!drawnLift) return null;
        const cells = liftCells(drawnLift.lift);
        const lit = id === hoveredLiftId;
        const offset = plateOffset(side, plateWidth(cells.name));

        return (
          <Html center key={id} position={drawnLift.line[tower].toArray()} zIndexRange={[6, 2]}>
            <span
              className={`${PLATE} cursor-default transition-opacity ${
                lit ? "border-sun/70 text-snow" : `border-line/60 text-snow/85 ${dim}`
              }`}
              onMouseEnter={() => onHoverLift(id)}
              onMouseLeave={() => onHoverLift(null)}
              style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
            >
              <LiftGlyph lit={lit} />
              <span className={`u-data text-[0.625rem] ${lit ? "text-snow" : "text-snow/85"}`}>
                {cells.name}
              </span>
              {/* Both numbers are metres, so each is named: unlabelled, a short
                  lift's rise and length are close enough to be read the wrong
                  way round. */}
              {lit && (
                <span className="u-data text-[0.625rem]">
                  Vertical <span className="text-snow">{cells.vertical}</span> · Length{" "}
                  <span className="text-snow">{cells.length}</span>
                </span>
              )}
            </span>
          </Html>
        );
      })}

      {layout.peaks.map(({ id, offset }) => {
        const marked = placeById.get(id);
        if (!marked) return null;
        const cells = placeCells(marked.place);
        const lit = id === hoveredPlaceId;
        const shift = PEAK_OFFSETS[offset];

        return (
          <Html center key={id} position={marked.at.toArray()} zIndexRange={[6, 2]}>
            <span
              className={`${PLATE} cursor-default ${
                lit ? "border-sun/70 text-snow" : "border-line/60 text-snow/90"
              }`}
              onMouseEnter={() => onHoverPlace(id)}
              onMouseLeave={() => onHoverPlace(null)}
              style={{ transform: `translate(${shift.x}px, ${shift.y}px)` }}
            >
              <PlaceMark kind={marked.place.kind} size={9} />
              <span className="u-feature text-[0.6875rem] leading-none">{cells.name}</span>
              <span className="u-data text-[0.625rem] leading-none">{cells.elevation}</span>
            </span>
          </Html>
        );
      })}

      {layout.marks.map(({ anchorId, ids }) => {
        const anchor = placeById.get(anchorId);
        if (!anchor) return null;
        const members = ids
          .map((id) => placeById.get(id))
          .filter((marked): marked is MarkedPlace => marked !== undefined);
        // Pointing at the row below opens the mark it is under, so the views answer both ways.
        const open =
          openId === anchorId || (hoveredPlaceId !== null && ids.includes(hoveredPlaceId));

        return (
          <Html
            center
            key={anchorId}
            position={anchor.at.toArray()}
            zIndexRange={open ? [8, 7] : [4, 1]}
          >
            <div
              className="relative"
              onClick={() => setOpenId(open ? null : anchorId)}
              onMouseEnter={() => {
                setOpenId(anchorId);
                if (members.length === 1) onHoverPlace(anchorId);
              }}
              onMouseLeave={() => {
                setOpenId(null);
                onHoverPlace(null);
              }}
            >
              <span
                className={`${PLATE} cursor-default px-1 ${
                  open ? "border-sun/70 text-snow" : "border-line/60 text-snow/80"
                }`}
              >
                <PlaceMark kind={anchor.place.kind} size={9} />
                {members.length > 1 && (
                  <span className="u-data text-[0.625rem] leading-none tabular-nums">
                    {members.length}
                  </span>
                )}
              </span>

              {/* One box with rows in it, not a pile of plates: five names at
                  the foot of the hill is a list, and a list has one edge. */}
              {open && (
                <ul
                  className={`${PLATE} absolute top-1/2 left-[calc(100%+0.5rem)] -translate-y-1/2 flex-col items-stretch gap-0 border-line/80 px-0 py-0`}
                >
                  {members.map(({ place }) => {
                    const cells = placeCells(place);
                    const lit = place.id === hoveredPlaceId;
                    return (
                      <li
                        className={`flex items-center gap-1.5 px-1.5 py-1 ${
                          lit ? "bg-surface text-snow" : "text-snow/90"
                        }`}
                        key={place.id}
                        onMouseEnter={() => onHoverPlace(place.id)}
                      >
                        <PlaceMark kind={place.kind} size={9} />
                        <span className="u-feature text-[0.6875rem] leading-none">
                          {cells.name}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Html>
        );
      })}
    </>
  );
}

/**
 * One pass of the layout: project everything, throw away what cannot be seen,
 * and hand out what room is left in order of importance.
 */
function decide(
  ranked: DrawnLift[],
  places: MarkedPlace[],
  field: Heightfield,
  camera: THREE.Camera,
  width: number,
  height: number,
  reserved: Rect[],
): Layout {
  const ndc = new THREE.Vector3();
  const eye: [number, number, number] = [camera.position.x, camera.position.y, camera.position.z];

  const project = (point: THREE.Vector3): { x: number; y: number } | null => {
    ndc.copy(point).project(camera);
    // Behind the camera comes back mirrored through the origin, on the far side of the screen.
    if (ndc.z > 1) return null;
    const x = (ndc.x * 0.5 + 0.5) * width;
    const y = (-ndc.y * 0.5 + 0.5) * height;
    if (x < EDGE_MARGIN_PX || x > width - EDGE_MARGIN_PX) return null;
    if (y < EDGE_MARGIN_PX || y > height - EDGE_MARGIN_PX) return null;
    return { x, y };
  };

  const visible = (point: THREE.Vector3): boolean =>
    isVisibleFrom(field, eye, [point.x, point.y, point.z]);

  const byId = new Map(places.map(({ place }) => [place.id, place]));
  const onScreen = new Map<string, { x: number; y: number }>();
  for (const { place, at } of places) {
    const screen = project(at);
    if (screen && visible(at)) onScreen.set(place.id, screen);
  }

  const groups = clusterPoints(
    places
      .filter(({ place }) => onScreen.has(place.id))
      .map(({ place }) => ({ id: place.id, ...onScreen.get(place.id)! })),
    CLUSTER_PX,
  );

  // Summits first and against an empty screen: a mountain's name is the one nothing pushes.
  const peaks = placePlates(
    groups
      .filter((group) => group.ids.length === 1 && byId.get(group.anchorId)?.kind === "peak")
      .map((group) => {
        const cells = placeCells(byId.get(group.anchorId)!);
        const at = onScreen.get(group.anchorId)!;
        return {
          id: group.anchorId,
          width: plateWidth(`${cells.name}${cells.elevation}`),
          height: PLATE_HEIGHT_PX,
          spots: PEAK_OFFSETS.map((rung) => ({ x: at.x + rung.x, y: at.y + rung.y })),
        };
      }),
    [],
  );

  const named = new Set(peaks.map((peak) => peak.id));
  const taken: Rect[] = [...reserved, ...peaks.map((peak) => peak.rect)];
  const marks: Layout["marks"] = [];
  for (const group of groups) {
    if (named.has(group.anchorId)) continue;
    marks.push({ anchorId: group.anchorId, ids: group.ids });
    const at = onScreen.get(group.anchorId)!;
    taken.push({
      x: at.x - MARK_PX / 2,
      y: at.y - MARK_PX / 2,
      width: MARK_PX,
      height: MARK_PX,
    });
  }

  const candidates: PlateCandidate[] = [];
  const options = new Map<string, { tower: number; side: number }[]>();
  for (const { lift, line } of ranked) {
    if (lift.name === null) continue;

    const towers = line.map((point) => (visible(point) ? project(point) : null));
    const seen: number[] = [];
    for (let i = 0; i < towers.length; i++) if (towers[i]) seen.push(i);
    if (seen.length === 0) continue;

    const first = towers[seen[0]]!;
    const last = towers[seen[seen.length - 1]]!;
    if (Math.hypot(last.x - first.x, last.y - first.y) < MIN_LIFT_PX) continue;

    // Middle first: half this mountain's top terminals share one ridge, stacking end labels.
    const plate = plateWidth(liftCells(lift).name);
    const tried = new Set<number>();
    const spots: { x: number; y: number }[] = [];
    const where: { tower: number; side: number }[] = [];

    for (const fraction of ALONG_CABLE) {
      const step = Math.round(fraction * (seen.length - 1));
      if (tried.has(step)) continue;
      tried.add(step);

      const tower = seen[step];
      const at = towers[tower]!;
      const before = towers[seen[Math.max(0, step - 1)]]!;
      const after = towers[seen[Math.min(seen.length - 1, step + 1)]]!;

      const [dx, dy] = [after.x - before.x, after.y - before.y];
      const run = Math.hypot(dx, dy) || 1;
      // Square to the cable, on the up-screen side where there is a choice.
      const up = dx > 0 ? 1 : -1;
      const side = compassSide((up * dy) / run, (-up * dx) / run);

      for (const chosen of [side, (side + COMPASS / 2) % COMPASS]) {
        const offset = plateOffset(chosen, plate);
        spots.push({ x: at.x + offset.x, y: at.y + offset.y });
        where.push({ tower, side: chosen });
      }
    }

    options.set(lift.id, where);
    candidates.push({ id: lift.id, width: plate, height: PLATE_HEIGHT_PX, spots });
  }

  const placed = placePlates(candidates, taken);

  return {
    lifts: placed.map(({ id, spot }) => ({ id, ...options.get(id)![spot] })),
    peaks: peaks.map(({ id, spot }) => ({ id, offset: spot })),
    marks,
  };
}

/**
 * The cableway hatch again, at label size: the plate carries the same mark the line does,
 * so the bars across a cable are learned once and read everywhere after.
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
