import { NextResponse } from "next/server";

/**
 * Live conditions — the only outbound call this project makes at runtime
 * (SPEC §5).
 *
 * Proxied rather than called from the browser so the response can be cached at
 * the edge and so a slow or down Open-Meteo degrades into a partial reading
 * instead of a broken page. Every field is nullable for that reason (phase 4
 * tests an API-down case explicitly).
 *
 * Nothing here is ever framed as advice. It reports snow, temperature and wind;
 * it does not say whether to ski (SPEC §8).
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/conditions/[slug]">,
) {
  const { slug } = await params;

  return NextResponse.json(
    { error: "Not implemented — phase 4", slug },
    { status: 501 },
  );
}
