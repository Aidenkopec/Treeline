/**
 * Share images (SPEC §4). Not implemented until phase 8, when it renders from
 * baked data alone so a shared link cannot fail on someone else's API.
 */
export async function GET() {
  // Static body: echoing the params back would reflect caller-supplied text.
  return new Response("Not implemented — phase 8.", {
    status: 501,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
