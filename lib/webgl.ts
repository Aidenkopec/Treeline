/**
 * Whether this browser can draw the mountain. Without a GPU the run table is the
 * site (SPEC §9), so the layout asks this too. Client only: the server has no
 * canvas, and answering during the server render is a hydration mismatch.
 */

let supported: boolean | undefined;

export function hasWebGL(): boolean {
  if (supported === undefined) {
    const gl = document.createElement("canvas").getContext("webgl2");
    supported = gl !== null;
    // A probe context is live, and browsers cap how many exist at once.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  }
  return supported;
}
