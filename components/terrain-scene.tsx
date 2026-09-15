"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, use, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { decodeHeightmap } from "@/lib/elevation";
import { terrainGeometry } from "@/lib/terrain-mesh";
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

const loading = new Map<string, Promise<Terrain>>();

function loadTerrain(resort: Resort): Promise<Terrain> {
  let pending = loading.get(resort.slug);
  if (!pending) {
    pending = buildTerrain(resort);
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
  // colorSpaceConversion "none" is load-bearing: by default the browser may
  // apply a colour profile to the PNG, which would quietly rewrite every
  // elevation in it. These pixels are measurements, not a picture.
  const bitmap = await createImageBitmap(await response.blob(), {
    colorSpaceConversion: "none",
    premultiplyAlpha: "none",
  });

  const context = new OffscreenCanvas(width, height).getContext("2d", {
    willReadFrequently: true,
  });
  if (!context) throw new Error("Could not read the heightmap: no 2d canvas context.");

  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const { data } = context.getImageData(0, 0, width, height);
  return decodeHeightmap(data, width, height, 4);
}

const FOV = 45;

/** Looking down on the massif from this far above the horizon frames it initially. */
const ELEVATION_ANGLE = (28 * Math.PI) / 180;

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

export default function TerrainScene({ resort }: { resort: Resort }) {
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
      <Suspense fallback={null}>
        <Massif palette={palette} resort={resort} />
      </Suspense>
    </Canvas>
  );
}

function Massif({
  palette,
  resort,
}: {
  palette: { sun: THREE.Color; shade: THREE.Color; ground: THREE.Color };
  resort: Resort;
}) {
  const { geometry, texture, groundWidth, groundDepth, relief } = use(loadTerrain(resort));
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const [idle, setIdle] = useState(true);

  const reducedMotion = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  // Framed from the terrain's own size rather than by tuned numbers, so a
  // bigger resort arrives already in shot. Seen from above the horizon the
  // massif is not a sphere but a plate: its depth foreshortens and its relief
  // stands up, and fitting a bounding sphere instead would back the camera off
  // to roughly twice the distance it needs.
  const framing = useMemo(() => {
    const half = Math.tan((FOV * Math.PI) / 360);
    const onScreenHeight =
      groundDepth * Math.sin(ELEVATION_ANGLE) + relief * Math.cos(ELEVATION_ANGLE);
    const distance =
      1.3 *
      Math.max(onScreenHeight / (2 * half), groundWidth / (2 * half * (size.width / size.height)));

    return {
      distance,
      position: [
        0,
        distance * Math.sin(ELEVATION_ANGLE),
        distance * Math.cos(ELEVATION_ANGLE),
      ] as const,
      target: [0, relief * 0.35, 0] as const,
    };
  }, [groundWidth, groundDepth, relief, size]);

  // Once only: the distance clamps should follow a resize, but moving the
  // camera back to its opening shot every time the window changes would
  // throw away wherever the viewer had got to.
  const framed = useRef(false);
  useLayoutEffect(() => {
    if (framed.current) return;
    framed.current = true;
    camera.position.set(...framing.position);
  }, [camera, framing]);

  return (
    <>
      <hemisphereLight args={[palette.shade, palette.ground, 1.6]} />
      <directionalLight
        color={palette.sun}
        intensity={2.6}
        position={[-framing.distance, framing.distance, -framing.distance * 0.6]}
      />

      <mesh geometry={geometry}>
        <meshStandardMaterial map={texture} metalness={0} roughness={1} />
      </mesh>

      <OrbitControls
        // Cinematic until touched, then it is yours (SPEC §4).
        autoRotate={idle && !reducedMotion}
        autoRotateSpeed={0.3}
        enableDamping
        makeDefault
        maxDistance={framing.distance * 2}
        maxPolarAngle={1.45}
        minDistance={framing.distance * 0.12}
        onStart={() => setIdle(false)}
        target={framing.target}
      />
    </>
  );
}
