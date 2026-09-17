"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import type { MountainOverlayState } from "@/components/lift-overlay";
import type { RunOverlayState } from "@/components/run-overlay";
import type { Inset } from "@/lib/inset";
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

/**
 * What the viewer reads instead of the mountain.
 *
 * Both reasons the scene can be missing end here, and both say the same second
 * sentence: the numbers on this page come from the elevation model, not from
 * the renderer, so none of them is affected by the canvas being absent.
 *
 * Centred rather than set along the bottom edge, which is where the map's own
 * attribution line stands.
 */
function SceneNotice({ children }: { children: ReactNode }) {
  return (
    <div className={`${FRAME} flex items-center justify-center px-6`}>
      <p className="max-w-[46ch] text-center text-sm text-rock">
        {children} The measurements come from the elevation model rather than from the renderer, and
        are unaffected.
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
  handheld,
  inset,
  mountain,
  overlay,
  resetSignal,
  resort,
  sunAt,
  webgl,
}: {
  /** A phone's GPU fills a 3x screen at a cost its battery notices. */
  handheld: boolean;
  /** What the drawer is standing on, in canvas pixels. */
  inset: Inset;
  mountain: MountainOverlayState;
  overlay: RunOverlayState;
  /** Bumped to send the camera home. Owned by the explorer, beside the button. */
  resetSignal: number;
  resort: Resort;
  /** The instant the sun is drawn at. Null until the client has a clock. */
  sunAt: Date | null;
  /** Whether this browser can draw the scene. Null until the client has asked. */
  webgl: boolean | null;
}) {
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
          <TerrainScene
            handheld={handheld}
            inset={inset}
            mountain={mountain}
            overlay={overlay}
            resetSignal={resetSignal}
            resort={resort}
            sunAt={sunAt}
          />
        </SceneBoundary>
      </div>
    </div>
  );
}
