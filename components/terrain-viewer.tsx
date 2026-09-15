"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode, useSyncExternalStore } from "react";
import type { RunOverlayState } from "@/components/run-overlay";
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

/** The viewer fills the box it is given; the page decides how tall that is. */
const FRAME = "h-full w-full";

let supported: boolean | undefined;

function hasWebGL(): boolean {
  if (supported === undefined) {
    const gl = document.createElement("canvas").getContext("webgl2");
    supported = gl !== null;
    // A probe context is still a live context, and browsers cap how many of
    // those exist at once — holding one costs the scene a slot it may need.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }
  return supported;
}

/** Nothing to subscribe to — WebGL support cannot change mid-session. */
const noop = () => () => {};

/**
 * What the viewer reads instead of the mountain.
 *
 * Both reasons the scene can be missing end here, and both say the same second
 * sentence: the numbers on this page come from the elevation model, not from
 * the renderer, so nothing above them is affected by the canvas being absent.
 */
function SceneNotice({ children }: { children: ReactNode }) {
  return (
    <div className={`${FRAME} flex items-end justify-center px-6 pb-12`}>
      <p className="max-w-[46ch] text-center text-sm text-rock">
        {children} The numbers above come from the same elevation model and are unaffected.
      </p>
    </div>
  );
}

/**
 * Keeps a failed terrain load inside the canvas's own frame.
 *
 * Without this the rejection reaches Next's root error boundary and replaces
 * the whole document — including the facts and the disclaimer, which are the
 * page whenever the 3D view cannot be (SPEC §9).
 */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <SceneNotice>The 3D terrain view could not be loaded.</SceneNotice>;
    }
    return this.props.children;
  }
}

export function TerrainViewer({ overlay, resort }: { overlay: RunOverlayState; resort: Resort }) {
  // Read on the client only: the server has no canvas to ask, and answering
  // either way during the server render would be a hydration mismatch.
  const webgl = useSyncExternalStore(noop, hasWebGL, () => null);

  if (webgl === null) {
    // Reserve the space so the header does not jump once the answer arrives.
    return <div className={FRAME} />;
  }

  if (!webgl) {
    return (
      <SceneNotice>The 3D terrain view needs WebGL, which this browser does not have.</SceneNotice>
    );
  }

  // The canvas carries nothing a screen reader can use — saying so is more
  // honest than an aria-label that pretends it describes the mountain (SPEC §9).
  return (
    <div aria-hidden="true" className={FRAME}>
      <SceneBoundary>
        <TerrainScene overlay={overlay} resort={resort} />
      </SceneBoundary>
    </div>
  );
}
