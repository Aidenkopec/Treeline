"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode, useState, useSyncExternalStore } from "react";
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

export function TerrainViewer({
  overlay,
  resort,
  sunAt,
}: {
  overlay: RunOverlayState;
  resort: Resort;
  /** The instant the sun is drawn at. Null until the client has a clock. */
  sunAt: Date | null;
}) {
  // Read on the client only: the server has no canvas to ask, and answering
  // either way during the server render would be a hydration mismatch.
  const webgl = useSyncExternalStore(noop, hasWebGL, () => null);
  // Lives here rather than with the rest of the explorer's state because this
  // is the only thing that presses it and the only thing that reads it, and
  // because there is no camera to send home when there is no canvas.
  const [resetSignal, setResetSignal] = useState(0);

  if (webgl === null) {
    // Reserve the space so the header does not jump once the answer arrives.
    return <div className={FRAME} />;
  }

  if (!webgl) {
    return (
      <SceneNotice>The 3D terrain view needs WebGL, which this browser does not have.</SceneNotice>
    );
  }

  return (
    <div className={`relative ${FRAME}`}>
      {/* The canvas carries nothing a screen reader can use — saying so is more
          honest than an aria-label that pretends it describes the mountain
          (SPEC §9). */}
      {/* Aerial perspective: the sky the massif fades into, so distance reads as
          distance rather than as a cut-out against flat page colour. Deep
          overhead, cool at the horizon, and the scene's fog is matched to the
          horizon end so the mesh meets it without a seam. */}
      <div
        aria-hidden="true"
        className={`${FRAME} bg-[linear-gradient(to_bottom,var(--color-shadow-deep)_0%,var(--color-shade-dim)_72%)]`}
      >
        <SceneBoundary>
          <TerrainScene overlay={overlay} resetSignal={resetSignal} resort={resort} sunAt={sunAt} />
        </SceneBoundary>
      </div>

      {/* The way back to the whole mountain, and conditional on nothing: the
          viewer this exists for has orbited or been flown into a corner of the
          mosaic, and has not necessarily picked a run to clear. Outside the
          aria-hidden wrapper above, so it is still reachable by keyboard.

          Same chrome as the explorer's own list toggle, so the two read as one
          set of controls rather than two widgets stuck to opposite corners. */}
      <div className="pointer-events-none absolute bottom-0 left-0 p-5">
        <button
          className="u-data pointer-events-auto flex cursor-pointer items-center gap-2 rounded border border-line bg-surface/90 px-3 py-2 text-rock shadow-panel backdrop-blur-sm transition-colors hover:border-rock-dim hover:text-snow"
          onClick={() => setResetSignal((presses) => presses + 1)}
          type="button"
        >
          <span aria-hidden="true">↺</span>
          Reset view
        </button>
      </div>
    </div>
  );
}
