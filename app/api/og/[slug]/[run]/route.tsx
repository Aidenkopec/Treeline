/**
 * Share images (SPEC §4, phase 8).
 *
 * Rendered from baked data only — no network call — so a shared link produces
 * the same card every time and cannot fail on someone else's API. Carries the
 * run's name, grade, pitch, aspect, vertical and elevation profile.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/og/[slug]/[run]">,
) {
  const { slug, run } = await params;

  return new Response(`Not implemented — phase 8 (${slug}/${run})`, {
    status: 501,
    headers: { "content-type": "text/plain" },
  });
}
