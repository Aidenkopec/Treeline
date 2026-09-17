/**
 * Share images (SPEC §4, phase 8).
 *
 * Rendered from baked data only — no network call — so a shared link produces
 * the same card every time and cannot fail on someone else's API. Carries the
 * run's name, grade, pitch, aspect, vertical and elevation profile.
 */
export async function GET() {
  // A static body: echoing the params back would reflect caller-supplied text,
  // which is not something a placeholder needs to do.
  return new Response("Not implemented — phase 8.", {
    status: 501,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
