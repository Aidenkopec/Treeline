"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, use, useLayoutEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { RunOverlay, type RunOverlayState } from "@/components/run-overlay";
import { decodeHeightmap } from "@/lib/elevation";
import { FOV, openingFraming, runExtent, terrainGeometry } from "@/lib/terrain-mesh";
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

export default function TerrainScene({
  overlay,
  resort,
}: {
  overlay: RunOverlayState;
  resort: Resort;
}) {
  // Suspending out here rather than inside <Canvas> is deliberate: R3F renders
  // canvas children through its own reconciler, so a failed load thrown in
  // there would not reach the error boundary in terrain-viewer.tsx.
  return (
    <Suspense fallback={<div className="h-full w-full bg-shadow-deep" />}>
      <LoadedScene overlay={overlay} resort={resort} />
    </Suspense>
  );
}

function LoadedScene({ overlay, resort }: { overlay: RunOverlayState; resort: Resort }) {
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
      <Massif overlay={overlay} palette={palette} resort={resort} terrain={terrain} />
    </Canvas>
  );
}

function Massif({
  overlay,
  palette,
  resort,
  terrain,
}: {
  overlay: RunOverlayState;
  palette: Palette;
  resort: Resort;
  terrain: Terrain;
}) {
  const { geometry, texture, ...extent } = terrain;
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const [idle, setIdle] = useState(true);

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
  }, [camera, opening]);

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
        onStart={() => setIdle(false)}
        target={opening.target}
      />
    </>
  );
}
