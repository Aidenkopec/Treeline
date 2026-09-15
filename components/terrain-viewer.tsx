"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";
import type { Resort } from "@/lib/types";

/**
 * The terrain view, and what stands in for it when there is no GPU.
 *
 * `next/dynamic` with `ssr: false` is only allowed inside a Client Component,
 * which is the reason this wrapper exists: it keeps three.js out of the server
 * render and out of the initial bundle, so the page's facts and disclaimer
 * arrive without waiting on a renderer.
 */
const TerrainScene = dynamic(() => import("./terrain-scene"), { ssr: false });

const FRAME = "h-[76svh] min-h-105 w-full";

let supported: boolean | undefined;

function hasWebGL(): boolean {
  supported ??= document.createElement("canvas").getContext("webgl2") !== null;
  return supported;
}

/** Nothing to subscribe to — WebGL support cannot change mid-session. */
const noop = () => () => {};

export function TerrainViewer({ resort }: { resort: Resort }) {
  // Read on the client only: the server has no canvas to ask, and answering
  // either way during the server render would be a hydration mismatch.
  const webgl = useSyncExternalStore(noop, hasWebGL, () => null);

  if (webgl === null) {
    // Reserve the space so the header does not jump once the answer arrives.
    return <div className={FRAME} />;
  }

  if (!webgl) {
    return (
      <div className={`${FRAME} flex items-end justify-center px-6 pb-12`}>
        <p className="max-w-[46ch] text-center text-sm text-rock">
          The 3D terrain view needs WebGL, which this browser does not have. The numbers above come
          from the same elevation model and are unaffected.
        </p>
      </div>
    );
  }

  // The canvas carries nothing a screen reader can use — saying so is more
  // honest than an aria-label that pretends it describes the mountain (SPEC §9).
  return (
    <div aria-hidden="true" className={FRAME}>
      <TerrainScene resort={resort} />
    </div>
  );
}
