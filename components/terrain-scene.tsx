"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  type ComponentRef,
  Suspense,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { RunOverlay, type RunOverlayState } from "@/components/run-overlay";
import { decodeHeightmap } from "@/lib/elevation";
import {
  FOV,
  type Framing,
  focusFraming,
  openingFraming,
  runExtent,
  terrainGeometry,
} from "@/lib/terrain-mesh";
import type { Resort } from "@/lib/types";

/**
 * The baked artifacts, rendered.
 *
 * Nothing here computes a run statistic or shades the mountain by steepness
 * (SPEC §8): this draws the ground the bake measured, with the imagery that
 * covers it, and stops. The lighting is the Imhof convention the palette is
 * already built on — warm where the sun lands, cool blue in shadow — and its
 * direction becomes a real sun position in phase 5.
 */

interface Terrain {
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture;
  groundWidth: number;
  groundDepth: number;
  relief: number;
}

interface Palette {
  sun: THREE.Color;
  shade: THREE.Color;
  ground: THREE.Color;
}

const loading = new Map<string, Promise<Terrain>>();

function loadTerrain(resort: Resort): Promise<Terrain> {
  let pending = loading.get(resort.slug);
  if (!pending) {
    pending = buildTerrain(resort);
    // A rejected load must not stay in the cache, or every later visit in this
    // session re-throws the first failure instead of trying the fetch again.
    pending.catch(() => loading.delete(resort.slug));
    loading.set(resort.slug, pending);
  }
  return pending;
}

async function buildTerrain(resort: Resort): Promise<Terrain> {
  const base = `/resorts/${resort.slug}`;
  const [elevations, texture] = await Promise.all([
    loadElevations(`${base}/heightmap.png`, resort.width, resort.height),
    new THREE.TextureLoader().loadAsync(`${base}/satellite.jpg`),
  ]);

  texture.colorSpace = THREE.SRGBColorSpace;
  // Clamped to whatever the GPU supports; the terrain is viewed at a raking
  // angle almost all the time, which is exactly where anisotropy earns itself.
  texture.anisotropy = 16;

  const { positions, uvs, indices, ...extent } = terrainGeometry(elevations, resort);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  return { geometry, texture, ...extent };
}

async function loadElevations(url: string, width: number, height: number): Promise<Float32Array> {
  const response = await fetch(url);
  // Without this an error page decodes as an image-shaped nothing and surfaces
  // much later as impossible elevations.
  if (!response.ok) {
    throw new Error(`Could not read the heightmap: ${url} returned ${response.status}.`);
  }

  // colorSpaceConversion "none" is load-bearing: by default the browser may
  // apply a colour profile to the PNG, which would quietly rewrite every
  // elevation in it. These pixels are measurements, not a picture.
  const bitmap = await createImageBitmap(await response.blob(), {
    colorSpaceConversion: "none",
    premultiplyAlpha: "none",
  });

  // A detached canvas rather than an OffscreenCanvas: this runs on the main
  // thread either way, and OffscreenCanvas landed in Safari four versions after
  // WebGL2 did, so reaching for it would crash browsers that pass the gate in
  // terrain-viewer.tsx.
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not read the heightmap: no 2d canvas context.");

  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const { data } = context.getImageData(0, 0, width, height);
  return decodeHeightmap(data, width, height, 4);
}

/** The palette lives in app/globals.css and is read from there, never re-typed. */
function paletteColor(name: string): THREE.Color {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new THREE.Color(value);
}

/**
 * A palette token as a light colour, pulled most of the way back to white.
 *
 * At full strength these are interface colours. A light multiplies the
 * satellite photograph by its colour, and gold at full saturation turns snow
 * into sand — the hue has to read as a lean, not as a filter.
 */
function lightColor(name: string, tint: number): THREE.Color {
  return new THREE.Color(0xffffff).lerp(paletteColor(name), tint);
}

/**
 * How long the camera takes to reach a run it has been asked to look at.
 *
 * The flight is most of what the move is for: arriving somewhere new says which
 * run it is, but watching the mountain turn under you is what says where on it.
 * Cut this much shorter and it reads as a cut rather than a move.
 */
const FLIGHT_MS = 900;

interface Flight {
  fromPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toPosition: THREE.Vector3;
  toTarget: THREE.Vector3;
  started: number;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export default function TerrainScene({
  overlay,
  resetSignal,
  resort,
}: {
  overlay: RunOverlayState;
  resetSignal: number;
  resort: Resort;
}) {
  // Suspending out here rather than inside <Canvas> is deliberate: R3F renders
  // canvas children through its own reconciler, so a failed load thrown in
  // there would not reach the error boundary in terrain-viewer.tsx.
  return (
    <Suspense fallback={<div className="h-full w-full bg-shadow-deep" />}>
      <LoadedScene overlay={overlay} resetSignal={resetSignal} resort={resort} />
    </Suspense>
  );
}

function LoadedScene({
  overlay,
  resetSignal,
  resort,
}: {
  overlay: RunOverlayState;
  resetSignal: number;
  resort: Resort;
}) {
  const terrain = use(loadTerrain(resort));
  const palette = useMemo(
    () => ({
      sun: lightColor("--color-sun", 0.3),
      shade: lightColor("--color-shade", 0.45),
      ground: paletteColor("--color-shadow-deep"),
    }),
    [],
  );

  return (
    <Canvas
      camera={{ far: 200000, fov: FOV, near: 10 }}
      dpr={[1, 2]}
      // The imagery is already a photograph of lit ground; a film curve on top
      // of it washes out the snow and greys the rock.
      gl={{ toneMapping: THREE.NoToneMapping }}
    >
      <color args={[palette.ground]} attach="background" />
      <Massif
        overlay={overlay}
        palette={palette}
        resetSignal={resetSignal}
        resort={resort}
        terrain={terrain}
      />
    </Canvas>
  );
}

function Massif({
  overlay,
  palette,
  resetSignal,
  resort,
  terrain,
}: {
  overlay: RunOverlayState;
  palette: Palette;
  resetSignal: number;
  resort: Resort;
  terrain: Terrain;
}) {
  const { geometry, texture, ...extent } = terrain;
  // Narrowed because the flight fits a run to the frame, and the frame's shape
  // is the camera's own aspect. Reading it here rather than from `state.size`
  // keeps a resize out of the flight's dependencies: R3F keeps this in step.
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const size = useThree((state) => state.size);
  const [idle, setIdle] = useState(true);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const flight = useRef<Flight | null>(null);
  // True while the camera is standing somewhere the app put it and nobody has
  // since taken hold. It is what lets clearing a run give back the flight and
  // nothing else: an orbit the viewer made themselves is theirs to keep.
  const movedByApp = useRef(false);

  const reducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // Frozen at first render. R3F withholds canvas children until it has measured,
  // so this aspect is the real one — and keeping it still is what stops a resize
  // recomputing the orbit clamps and dragging the camera back off wherever the
  // viewer had got to.
  //
  // Framed on the runs, not on the mosaic. The mosaic is cut to whole tiles and
  // reaches well past the pistes, so fitting it spends most of the canvas on
  // ground with nothing drawn on it. `overlay.runs` is the unfiltered list: the
  // opening is frozen, and freezing a filtered framing would bake in whatever
  // filter happened to be set at mount.
  const [opening] = useState(() => {
    const aspect = size.width / size.height;
    // Zooming out is still measured against the whole mountain — tying it to
    // the closer framing would stop the pull-back short of the massif.
    const whole = openingFraming(extent, aspect);
    return {
      ...openingFraming(extent, aspect, runExtent(overlay.runs, resort)),
      maxDistance: whole.distance * 2,
    };
  });

  useLayoutEffect(() => {
    camera.position.set(...opening.position);
    controls.current?.target.set(...opening.target);
  }, [camera, opening]);

  const flyTo = useCallback(
    (to: Framing) => {
      const orbit = controls.current;
      if (orbit === null) return;

      const toPosition = new THREE.Vector3(...to.position);
      const toTarget = new THREE.Vector3(...to.target);

      if (reducedMotion) {
        flight.current = null;
        camera.position.copy(toPosition);
        orbit.target.copy(toTarget);
        return;
      }

      flight.current = {
        fromPosition: camera.position.clone(),
        fromTarget: orbit.target.clone(),
        toPosition,
        toTarget,
        started: performance.now(),
      };
    },
    [camera, reducedMotion],
  );

  // Selection only. Hover moves nothing: the list is 168 rows long and a camera
  // that answered every one of them on the way past would be a strobe.
  const { runs, selectedId } = overlay;

  useEffect(() => {
    const orbit = controls.current;
    if (orbit === null) return;

    if (selectedId === null) {
      // Clearing hands back the flight, and only the flight. Having orbited
      // since, the viewer is somewhere they chose, and a pull-back nobody asked
      // for would throw that away. This also covers a filter hiding the run
      // that was picked, which is a clearing the reader did not press a button
      // for and the one most likely to leave them parked on empty hillside.
      if (!movedByApp.current) return;
      movedByApp.current = false;
      flyTo(opening);
      return;
    }

    const run = runs.find((candidate) => candidate.id === selectedId);
    if (run === undefined) return;
    const box = runExtent([run], resort);
    if (box === null) return;

    // `orbit` is passed for its clamps, which are the ones it will hold the
    // camera to the moment the flight lands.
    const framing = focusFraming(
      box,
      run.aspect_deg,
      {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [orbit.target.x, orbit.target.y, orbit.target.z],
      },
      camera.aspect,
      orbit,
    );

    movedByApp.current = true;
    flyTo(framing);
  }, [camera, flyTo, opening, resort, runs, selectedId]);

  // A counter rather than a flag: pressing reset twice has to fly twice, and
  // there is no "arrived" for the button to wait on. Compared against the last
  // value seen rather than against zero, so the flight belongs to the press and
  // not to whatever else may one day put this effect through another run.
  const lastReset = useRef(resetSignal);

  useEffect(() => {
    if (lastReset.current === resetSignal) return;
    lastReset.current = resetSignal;
    // Home is now where the viewer put the camera, so clearing a run after this
    // must not move it again.
    movedByApp.current = false;
    flyTo(opening);
  }, [flyTo, opening, resetSignal]);

  // Ahead of the controls' own update, which drei runs at -1: the camera is
  // moved first and the controls read it once, rather than the two taking turns
  // damping each other in the same frame.
  useFrame(() => {
    const moving = flight.current;
    const orbit = controls.current;
    if (moving === null || orbit === null) return;

    const t = Math.min(1, (performance.now() - moving.started) / FLIGHT_MS);
    const eased = easeInOutCubic(t);
    camera.position.lerpVectors(moving.fromPosition, moving.toPosition, eased);
    orbit.target.lerpVectors(moving.fromTarget, moving.toTarget, eased);
    if (t === 1) flight.current = null;
  }, -2);

  return (
    <>
      <hemisphereLight args={[palette.shade, palette.ground, 1.6]} />
      <directionalLight
        color={palette.sun}
        intensity={2.6}
        position={[-opening.distance, opening.distance, -opening.distance * 0.6]}
      />

      <mesh geometry={geometry}>
        <meshStandardMaterial map={texture} metalness={0} roughness={1} />
      </mesh>

      <RunOverlay resort={resort} state={overlay} />

      <OrbitControls
        // Cinematic until touched, then it is yours (SPEC §4). Narrowing the
        // list or picking a run counts as touching it: the mountain now sits
        // beside the list rather than above it, and one that keeps turning
        // while a run is being read is a fidget. Every run still standing and
        // none picked out is the only state nobody has engaged with yet.
        autoRotate={
          idle &&
          !reducedMotion &&
          overlay.selectedId === null &&
          overlay.visibleIds.size === overlay.runs.length
        }
        autoRotateSpeed={0.3}
        enableDamping
        makeDefault
        maxDistance={opening.maxDistance}
        maxPolarAngle={1.45}
        minDistance={opening.distance * 0.12}
        onStart={() => {
          // Taking hold of the mountain ends the flight where it has got to,
          // rather than the camera finishing a move you have overruled — and
          // from here the view is yours, so clearing the run leaves it alone.
          flight.current = null;
          movedByApp.current = false;
          setIdle(false);
        }}
        ref={controls}
      />
    </>
  );
}
