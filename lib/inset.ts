/**
 * What the page's own chrome stands on, so the scene can compose around it. The camera
 * is told this in canvas pixels and answers by moving its projection rather than itself
 * (the view offset in `components/terrain-scene.tsx`).
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
 * The masthead across the top; the drawer at the right edge when docked and along the
 * bottom when not, but only once raised. Both read from their measured box rather than
 * their position, which slides for the length of the drawer's transition.
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
 * Whether the list is out before anyone has said. Without a GPU the list is the site
 * (SPEC §9). On a phone the sheet is most of the window, so raised by default would
 * open the page on a table with the mountain behind it.
 */
export function drawerOpen({
  choice,
  phone,
  steerOnMap,
}: {
  /** What the reader last asked for, or null if they have not asked. */
  choice: boolean | null;
  phone: boolean;
  steerOnMap: boolean;
}): boolean {
  if (!steerOnMap) return true;
  return choice ?? !phone;
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
