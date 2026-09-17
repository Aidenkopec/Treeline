"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useStore, useThree } from "@react-three/fiber";
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
import { LiftOverlay, type MountainOverlayState } from "@/components/lift-overlay";
import { RunOverlay, type RunOverlayState } from "@/components/run-overlay";
import { decodeHeightmap } from "@/lib/elevation";
import { type Inset, viewFrame } from "@/lib/inset";
import { sunDirection, sunPosition } from "@/lib/sun";
import {
  FOV,
  type Framing,
  focusFraming,
  type Heightfield,
  heightfield,
  openingFraming,
  runExtent,
  terrainGeometry,
} from "@/lib/terrain-mesh";
import type { Resort } from "@/lib/types";

/**
 * The baked artifacts, rendered. Nothing here computes a run statistic or shades the
 * mountain by steepness (SPEC §8). The key light stands where `suncalc` puts the sun, and
 * the palette is the Imhof convention: warm where the sun lands, cool blue in shadow.
 */

interface Terrain {
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture;
  /**
   * The same vertices the geometry holds, read as a grid. The labels ask it whether a
   * ridge stands between the camera and the thing they name. A raycast would answer from
   * the same triangles, but nothing indexes them and the question is asked every move.
   */
  field: Heightfield;
  groundWidth: number;
  groundDepth: number;
  relief: number;
}

interface Palette {
  sun: THREE.Color;
  shade: THREE.Color;
  ground: THREE.Color;
  /** Bounce under a downward-facing slope. The page colour reads as dirt on snow. */
  fill: THREE.Color;
  /** The horizon the massif fades into. Matched to the gradient in terrain-viewer. */
  haze: THREE.Color;
}

const loading = new Map<string, Promise<Terrain>>();

function loadTerrain(resort: Resort): Promise<Terrain> {
  let pending = loading.get(resort.slug);
  if (!pending) {
    pending = buildTerrain(resort);
    // A rejected load must not stay cached, or every later visit re-throws that failure.
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
  // Clamped to what the GPU supports; the terrain is viewed at a raking angle almost always.
  texture.anisotropy = 16;

  const { positions, uvs, indices, ...extent } = terrainGeometry(elevations, resort);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  return { geometry, texture, field: heightfield(positions, resort), ...extent };
}

async function loadElevations(url: string, width: number, height: number): Promise<Float32Array> {
  const response = await fetch(url);
  // Without this an error page decodes as image-shaped nothing and surfaces as elevations.
  if (!response.ok) {
    throw new Error(`Could not read the heightmap: ${url} returned ${response.status}.`);
  }

  // `colorSpaceConversion: "none"` is load-bearing: a colour profile rewrites elevations.
  const bitmap = await createImageBitmap(await response.blob(), {
    colorSpaceConversion: "none",
    premultiplyAlpha: "none",
  });

  // Not OffscreenCanvas: it landed in Safari four versions after WebGL2, which gates this.
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
 * A palette token as a light colour, pulled most of the way back to white. At full
 * strength these are interface colours, and a light multiplies the drape by its colour,
 * so gold at full saturation turns snow into sand. The hue is a lean, not a filter.
 */
function lightColor(name: string, tint: number): THREE.Color {
  return new THREE.Color(0xffffff).lerp(paletteColor(name), tint);
}

/** The key light's strength with the sun high. Metered for the drape's forest. */
const KEY_INTENSITY = 2.8;

/**
 * 2048 across the massif is finer than the heightmap it shadows — see
 * `shadowReach` — so raising it would sharpen nothing the terrain can express.
 */
const SHADOW_TEXELS = 2048;

/**
 * Where the sun stands for the one render before the client has read a clock.
 * South-west and high, which is the framing the opening shot is fitted to.
 */
const SUN_BEFORE_HYDRATION: readonly [number, number, number] = [-0.5, 0.75, 0.43];

/** Sky and bounce, with the sun high and with it gone. */
const FILL_DAY = 1.4;
const FILL_NIGHT = 0.55;

/** Above this the sun is simply out; below it, it is going. Degrees. */
const DUSK_DEG = 12;

/**
 * How much of the key survives at a given sun altitude, 0 to 1. Extinction only: a slope
 * turning away is already the material's job, and folding it in here would count it
 * twice. Smoothstep, so the last minutes before sunset are a fade rather than a switch.
 */
function keyStrength(altitudeDeg: number): number {
  const t = Math.min(1, Math.max(0, altitudeDeg / DUSK_DEG));
  return t * t * (3 - 2 * t);
}

/**
 * How long the camera takes to reach a run it has been asked to look at. Watching the
 * mountain turn is what says where the run is; much shorter and it reads as a cut.
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
  handheld,
  mountain,
  inset,
  overlay,
  resetSignal,
  resort,
  sunAt,
}: {
  /** A phone's GPU fills a 3x screen at a cost its battery notices. */
  handheld: boolean;
  /** What the drawer is standing on, in canvas pixels. */
  inset: Inset;
  mountain: MountainOverlayState;
  overlay: RunOverlayState;
  resetSignal: number;
  resort: Resort;
  sunAt: Date | null;
}) {
  // Suspending outside <Canvas>: R3F's own reconciler would keep a throw from the boundary.
  return (
    <Suspense fallback={<div className="h-full w-full bg-shadow-deep" />}>
      <LoadedScene
        handheld={handheld}
        inset={inset}
        mountain={mountain}
        overlay={overlay}
        resetSignal={resetSignal}
        resort={resort}
        sunAt={sunAt}
      />
    </Suspense>
  );
}

function LoadedScene({
  handheld,
  inset,
  mountain,
  overlay,
  resetSignal,
  resort,
  sunAt,
}: {
  handheld: boolean;
  inset: Inset;
  mountain: MountainOverlayState;
  overlay: RunOverlayState;
  resetSignal: number;
  resort: Resort;
  sunAt: Date | null;
}) {
  const terrain = use(loadTerrain(resort));
  const palette = useMemo(
    () => ({
      sun: lightColor("--color-sun", 0.5),
      shade: lightColor("--color-shade", 0.62),
      ground: paletteColor("--color-shadow-deep"),
      fill: paletteColor("--color-shade-dim"),
      haze: paletteColor("--color-shade-dim"),
    }),
    [],
  );

  return (
    <Canvas
      camera={{ far: 200000, fov: FOV, near: 10 }}
      // Capped lower on a handheld: a 3x screen is nine times the pixels of a 1x one.
      dpr={handheld ? [1, 1.5] : [1, 2]}
      // Exposed for the mid-tones, letting sunlit snow blow out; a film curve flattens it.
      gl={{ alpha: true, toneMapping: THREE.NoToneMapping }}
      // `percentage` is PCFShadowMap; bare `shadows` asks for one three removed in r186.
      shadows="percentage"
    >
      <Massif
        inset={inset}
        mountain={mountain}
        overlay={overlay}
        palette={palette}
        resetSignal={resetSignal}
        resort={resort}
        sunAt={sunAt}
        terrain={terrain}
      />
    </Canvas>
  );
}

function Massif({
  inset,
  mountain,
  overlay,
  palette,
  resetSignal,
  resort,
  sunAt,
  terrain,
}: {
  inset: Inset;
  mountain: MountainOverlayState;
  overlay: RunOverlayState;
  palette: Palette;
  resetSignal: number;
  resort: Resort;
  sunAt: Date | null;
  terrain: Terrain;
}) {
  const { geometry, texture, field, ...extent } = terrain;
  // The mosaic's own diagonal, which is what the haze below is measured in.
  const reach = Math.hypot(extent.groundWidth, extent.groundDepth);
  // Read here rather than from `state.size`, which keeps a resize out of the flight's deps.
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const store = useStore();
  const size = useThree((state) => state.size);
  const [idle, setIdle] = useState(true);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const flight = useRef<Flight | null>(null);
  // True while the camera stands where the app put it: an orbit the viewer made is theirs.
  const movedByApp = useRef(false);

  const reducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // Null only across the hydration pass, and the opening framing is an afternoon anyway.
  const sun = useMemo(() => {
    if (sunAt === null) return null;
    const position = sunPosition(resort, sunAt);
    return {
      direction: sunDirection(position, resort.vertical_exaggeration),
      strength: keyStrength(position.altitudeDeg),
    };
  }, [resort, sunAt]);

  // On demand, not per frame: the terrain is the only caster and only the sun moves it.
  useEffect(() => {
    const { shadowMap } = store.getState().gl;
    shadowMap.autoUpdate = false;
    shadowMap.needsUpdate = true;
  }, [store, sun]);

  // Frozen at first render, on the unfiltered runs: a resize or a filter must not reframe.
  const [opening] = useState(() => {
    const aspect = size.width / size.height;
    // Zooming out is measured against the whole mountain, not the closer framing.
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

  /**
   * Compose the massif into the strip the chrome leaves, by projection alone —
   * moving the camera or its target would put the orbit's centre off the massif.
   * Re-applied on every resize: R3F rewrites `camera.aspect` from the canvas.
   */
  useLayoutEffect(() => {
    // Through the store: assigning to a field the renderer handed back trips immutability.
    const lens = store.getState().camera as THREE.PerspectiveCamera;
    const covered = inset.top > 0 || inset.right > 0 || inset.bottom > 0;

    if (size.width > 0 && size.height > 0 && covered) {
      const frame = viewFrame(size.width, size.height, inset);
      // `setViewOffset` writes `aspect` itself; the branch below must not.
      lens.setViewOffset(
        frame.fullWidth,
        frame.fullHeight,
        frame.offsetX,
        frame.offsetY,
        frame.width,
        frame.height,
      );
    } else {
      lens.aspect = size.width / Math.max(1, size.height);
      lens.clearViewOffset();
    }
    lens.updateProjectionMatrix();
  }, [inset, size, store]);

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

  // Selection only. Hover moves nothing: 168 rows answering on the way past is a strobe.
  const { runs, selectedId } = overlay;

  useEffect(() => {
    const orbit = controls.current;
    if (orbit === null) return;

    if (selectedId === null) {
      // Clearing hands back the flight and only that: an orbit since is the viewer's own.
      if (!movedByApp.current) return;
      movedByApp.current = false;
      flyTo(opening);
      return;
    }

    const run = runs.find((candidate) => candidate.id === selectedId);
    if (run === undefined) return;
    const box = runExtent([run], resort);
    if (box === null) return;

    // `orbit` is passed for its clamps, which hold the camera the moment the flight lands.
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

  // A counter rather than a flag: pressing reset twice has to fly twice, with no arrival.
  const lastReset = useRef(resetSignal);

  useEffect(() => {
    if (lastReset.current === resetSignal) return;
    lastReset.current = resetSignal;
    // Home is where the viewer put it, so clearing a run after this must not move it again.
    movedByApp.current = false;
    flyTo(opening);
  }, [flyTo, opening, resetSignal]);

  // Ahead of drei's own update at -1, so the two do not take turns damping in one frame.
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

  const direction = sun?.direction ?? SUN_BEFORE_HYDRATION;
  const strength = sun?.strength ?? 1;
  // Half the mosaic's diagonal and its relief: an ortho frustum this wide holds every sun.
  const shadowReach = Math.hypot(reach / 2, extent.relief);

  return (
    <>
      {/* Aerial perspective, measured against the mosaic rather than the camera:
          the far side of a massif sits back from the near side by the same amount
          however close the viewer has flown. Linear, for a cue over a known span. */}
      <fog args={[palette.haze, reach * 0.55, reach * 1.6]} attach="fog" />
      {/* Sky and bounce carry the whole scene once the sun is down, so this
          rises as the key falls — a blue mountain at night rather than a black
          one, and not a flat overcast day at noon either. */}
      <hemisphereLight
        args={[palette.shade, palette.fill, FILL_NIGHT + (FILL_DAY - FILL_NIGHT) * strength]}
      />
      {/* A direction, scaled out to the mosaic's own diagonal so the light clears
          the terrain whatever the sun is doing. The colour leans gold as it drops. */}
      <directionalLight
        castShadow
        color={lightColor("--color-sun", 0.5 + 0.35 * (1 - strength))}
        intensity={KEY_INTENSITY * strength}
        position={[direction[0] * reach, direction[1] * reach, direction[2] * reach]}
        shadow-mapSize={[SHADOW_TEXELS, SHADOW_TEXELS]}
        shadow-normalBias={(2 * shadowReach) / SHADOW_TEXELS}
      >
        {/* Built rather than assigned field by field: setting `shadow-camera-near`
            and its neighbours leaves the projection matrix on the default ten-unit
            box, and that frustum reports a ten-kilometre massif wholly shadowed. */}
        <orthographicCamera
          args={[
            -shadowReach,
            shadowReach,
            shadowReach,
            -shadowReach,
            reach - shadowReach,
            reach + shadowReach,
          ]}
          attach="shadow-camera"
        />
      </directionalLight>

      <mesh castShadow geometry={geometry} receiveShadow>
        <meshStandardMaterial map={texture} metalness={0} roughness={1} />
      </mesh>

      {/* Drawn before the runs so a run always reads over a cable: a lift is
          context, a run is the subject. The lift names step back for the same
          reason once a run is being read. */}
      <LiftOverlay
        field={field}
        receded={overlay.selectedId !== null || overlay.hoveredId !== null}
        resort={resort}
        state={mountain}
      />

      <RunOverlay resort={resort} state={overlay} />

      <OrbitControls
        // Cinematic until touched (SPEC §4); filtering or picking a run counts as touching.
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
          // Taking hold ends the flight where it got to, and the view is then the viewer's.
          flight.current = null;
          movedByApp.current = false;
          setIdle(false);
        }}
        ref={controls}
      />
    </>
  );
}
