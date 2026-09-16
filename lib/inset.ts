/**
 * What the page's own chrome is standing on, so the scene can compose around it.
 *
 * The camera is told this in canvas pixels and answers by moving its
 * projection, not itself — see the view offset in `components/terrain-scene.tsx`.
 * Deciding it is pure, so which edge is covered in which layout is settled by
 * `npm test` rather than by dragging a window to the breakpoint.
 */
export interface Inset {
  /** Canvas pixels covered along the top edge. */
  top: number;
  /** Canvas pixels covered along the right edge. */
  right: number;
  /** Canvas pixels covered along the bottom edge. */
  bottom: number;
}

export const NO_INSET: Inset = { top: 0, right: 0, bottom: 0 };

/**
 * Two sources, on three edges.
 *
 * The masthead is always across the top. The drawer is a full-height panel at
 * the right edge when it is docked and a sheet along the bottom when it is not
 * — but only once raised: peeked, it is a head at the very edge of the frame
 * and there is nothing behind it worth composing for.
 *
 * Both are given their own measured box, which holds still. Position does not:
 * the drawer slides for the length of its transition, and an inset read from
 * that would drag the mountain along with it a frame at a time.
 */
export function chromeInset({
  docked,
  drawerHeight,
  drawerWidth,
  mastheadHeight,
  open,
}: {
  docked: boolean;
  drawerHeight: number;
  drawerWidth: number;
  mastheadHeight: number;
  open: boolean;
}): Inset {
  const drawer = !open
    ? { right: 0, bottom: 0 }
    : docked
      ? { right: drawerWidth, bottom: 0 }
      : { right: 0, bottom: drawerHeight };

  return { top: mastheadHeight, ...drawer };
}

/**
 * A `setViewOffset` frame: the clear strip is the frame, the canvas is the
 * larger crop around it. Growing the frame past the canvas instead renders a
 * window onto a wider view, which magnifies rather than fits.
 */
export interface ViewFrame {
  fullWidth: number;
  fullHeight: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

export function viewFrame(width: number, height: number, inset: Inset): ViewFrame {
  return {
    // A short window's chrome can exceed it, and a zero-height frame is a NaN aspect.
    fullWidth: Math.max(1, width - inset.right),
    fullHeight: Math.max(1, height - inset.top - inset.bottom),
    offsetX: 0,
    offsetY: -inset.top,
    width,
    height,
  };
}

/** Whether two insets say the same thing, so a settled one keeps its identity. */
export function sameInset(a: Inset, b: Inset): boolean {
  return a.top === b.top && a.right === b.right && a.bottom === b.bottom;
}
