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
import { sunDirection, sunPosition } from "@/lib/sun";
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
 * (SPEC §8): this draws the ground the bake measured, with the winter surface
 * the bake remapped Esri's imagery into, and stops. The key light stands where
 * `suncalc` puts the sun and casts the shadows that position throws; the
 * palette it is coloured from is the Imhof convention — warm where the sun
 * lands, cool blue in shadow.
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
 * At full strength these are interface colours. A light multiplies the drape
 * by its colour, and gold at full saturation turns snow into sand — the hue has
 * to read as a lean, not as a filter. The leans are wider than they look like
 * they should be because the drape is near-neutral: these two are the only
 * colour in the scene, where over a photograph they were only a tilt on one.
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
 * How much of the key survives at a given sun altitude, 0 to 1.
 *
 * This is extinction and nothing else — how much light the atmosphere leaves at
 * a low sun. The geometry of a slope turning away is already the material's
 * job, and folding it in here would count it twice. Smoothstep so the last
 * minutes before sunset are a fade rather than a switch, and so the mountain is
 * not still fully lit one frame before it goes dark.
 */
function keyStrength(altitudeDeg: number): number {
  const t = Math.min(1, Math.max(0, altitudeDeg / DUSK_DEG));
  return t * t * (3 - 2 * t);
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
  mountain,
  overlay,
  resetSignal,
  resort,
  sunAt,
}: {
  mountain: MountainOverlayState;
  overlay: RunOverlayState;
  resetSignal: number;
  resort: Resort;
  sunAt: Date | null;
}) {
  // Suspending out here rather than inside <Canvas> is deliberate: R3F renders
  // canvas children through its own reconciler, so a failed load thrown in
  // there would not reach the error boundary in terrain-viewer.tsx.
  return (
    <Suspense fallback={<div className="h-full w-full bg-shadow-deep" />}>
      <LoadedScene
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
  mountain,
  overlay,
  resetSignal,
  resort,
  sunAt,
}: {
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
      dpr={[1, 2]}
      // Lambert divides by pi, so the lights below are exposed for the
      // mid-tones — the drape's forest — rather than for its brightest snow,
      // which is left free to blow out on a slope facing the sun the way a
      // snowfield does. A film curve would pull that back and would flatten the
      // warm/cool split, which is the only colour a near-neutral snow has.
      gl={{ alpha: true, toneMapping: THREE.NoToneMapping }}
      // The terrain is the only caster and it never moves, so the map is
      // re-rendered when the sun moves and at no other time — see the effect in
      // Massif. Steady-state cost is one pass, the same as before phase 5.
      shadows
    >
      <Massif
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
  mountain,
  overlay,
  palette,
  resetSignal,
  resort,
  sunAt,
  terrain,
}: {
  mountain: MountainOverlayState;
  overlay: RunOverlayState;
  palette: Palette;
  resetSignal: number;
  resort: Resort;
  sunAt: Date | null;
  terrain: Terrain;
}) {
  const { geometry, texture, ...extent } = terrain;
  // The mosaic's own diagonal, which is what the haze below is measured in.
  const reach = Math.hypot(extent.groundWidth, extent.groundDepth);
  // Narrowed because the flight fits a run to the frame, and the frame's shape
  // is the camera's own aspect. Reading it here rather than from `state.size`
  // keeps a resize out of the flight's dependencies: R3F keeps this in step.
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const store = useStore();
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

  // Where the sun stands, and how much of it is left. Null only across the
  // hydration pass, and the opening framing is an afternoon either way.
  const sun = useMemo(() => {
    if (sunAt === null) return null;
    const position = sunPosition(resort, sunAt);
    return {
      direction: sunDirection(position, resort.vertical_exaggeration),
      strength: keyStrength(position.altitudeDeg),
    };
  }, [resort, sunAt]);

  // The shadow map is rendered on demand rather than every frame: the terrain
  // is the only caster and it never moves, so the only thing that can change it
  // is the sun. `autoUpdate` is turned off once and the map is asked for again
  // whenever this effect re-runs, which includes the first mount.
  useEffect(() => {
    const { shadowMap } = store.getState().gl;
    shadowMap.autoUpdate = false;
    shadowMap.needsUpdate = true;
  }, [store, sun]);

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

  const direction = sun?.direction ?? SUN_BEFORE_HYDRATION;
  const strength = sun?.strength ?? 1;
  // Every mesh vertex lies within this of the origin — half the mosaic's
  // diagonal across, its relief up — so an orthographic frustum this wide
  // contains the whole massif at every sun angle, low ones included. At Lake
  // Louise that is 5.8 m per texel against an 11.9 m heightmap pixel, so the
  // shadow map is not what limits the shadow.
  const shadowReach = Math.hypot(reach / 2, extent.relief);

  return (
    <>
      {/* Aerial perspective, measured against the mosaic rather than against the
          camera: the far side of a massif should sit back from the near side by
          the same amount however close the viewer has flown. Linear, because
          what is wanted is a legible depth cue over a known span and not a
          physical scattering model. */}
      <fog args={[palette.haze, reach * 0.55, reach * 1.6]} attach="fog" />
      {/* Sky and bounce carry the whole scene once the sun is down, so this
          rises as the key falls — a blue mountain at night rather than a black
          one, and not a flat overcast day at noon either. */}
      <hemisphereLight
        args={[palette.shade, palette.fill, FILL_NIGHT + (FILL_DAY - FILL_NIGHT) * strength]}
      />
      {/* A direction, scaled out to the mosaic's own diagonal so the light
          clears the terrain whatever the sun is doing. The colour leans further
          into the gold as the sun drops, which is what the atmosphere does to
          it; `lightColor` keeps that a lean rather than a filter. */}
      <directionalLight
        castShadow
        color={lightColor("--color-sun", 0.5 + 0.35 * (1 - strength))}
        intensity={KEY_INTENSITY * strength}
        position={[direction[0] * reach, direction[1] * reach, direction[2] * reach]}
        shadow-mapSize={[SHADOW_TEXELS, SHADOW_TEXELS]}
        shadow-normalBias={(2 * shadowReach) / SHADOW_TEXELS}
      >
        {/* Built rather than assigned field by field. Setting
            `shadow-camera-near` and its neighbours leaves the projection matrix
            on the ten-unit box the default shadow camera was constructed with,
            and a frustum that covers ten metres of a ten-kilometre massif
            reports the whole mountain as shadowed — which is a black mountain,
            not a missing shadow. */}
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
          context, a run is the subject. */}
      <LiftOverlay resort={resort} state={mountain} />

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
