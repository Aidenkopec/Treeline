/**
 * Whether this browser can draw the mountain at all.
 *
 * Shared rather than owned by the viewer because the answer decides more than
 * the canvas: without a GPU the run table is the site (SPEC §9), so the layout
 * has to open the drawer and drop the chrome that only makes sense over
 * terrain. One probe, one cached answer, asked by whoever needs it.
 *
 * Client only — the server has no canvas to ask, and answering either way
 * during the server render would be a hydration mismatch.
 */

let supported: boolean | undefined;

export function hasWebGL(): boolean {
  if (supported === undefined) {
    const gl = document.createElement("canvas").getContext("webgl2");
    supported = gl !== null;
    // A probe context is still a live context, and browsers cap how many of
    // those exist at once — holding one costs the scene a slot it may need.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }
  return supported;
}
