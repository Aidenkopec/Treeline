import { conditionsUrl, parseConditions } from "@/lib/conditions";
import { plannedResorts } from "@/lib/manifest";

/**
 * Live conditions — the only outbound call this project makes at runtime
 * (SPEC §5).
 *
 * Proxied rather than called from the browser so the response can be cached at
 * the edge, and so one slow resort cannot be turned into a flood of requests
 * against a free, keyless, non-commercial service.
 *
 * Nothing here is ever framed as advice. It reports snow, temperature and wind;
 * it does not say whether to ski (SPEC §8).
 */

const UPSTREAM_TIMEOUT_MS = 4000;

/**
 * 900s is Open-Meteo's own update interval (`current.interval`), so asking more
 * often than that returns the same numbers. `stale-while-revalidate` is what
 * keeps the last real reading on screen while a refetch is in flight; past that
 * an outage is a 502 and the strip reads as dashes. `stale-if-error` would be
 * the directive for the rest, but Vercel does not honour it.
 */
const CACHE_CONTROL = "public, s-maxage=900, stale-while-revalidate=3600";

export async function GET(_request: Request, { params }: RouteContext<"/api/conditions/[slug]">) {
  const { slug } = await params;

  // The lat/lon that reach Open-Meteo are only ever values committed in
  // resorts.json, and an unknown slug is answered before any request is made.
  // That is what stops this being a proxy a caller can point anywhere.
  const resort = plannedResorts().find((candidate) => candidate.slug === slug);
  if (!resort) {
    return Response.json(
      { error: "unknown_resort" },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  }

  let payload: unknown;
  try {
    const response = await fetch(conditionsUrl(resort.lat, resort.lon), {
      headers: { "User-Agent": "treeline (+https://treeline.aidenkopec.com)" },
      // One attempt, deliberately unlike the bake's retry ladder in
      // scripts/bake/cache.ts. Retrying inside a request only makes the visitor
      // wait twice; the cache directives above are what absorb a blip.
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!response.ok) return unavailable();
    payload = await response.json();
  } catch {
    return unavailable();
  }

  const conditions = parseConditions(slug, payload);
  if (!conditions) return unavailable();

  return Response.json(conditions, { headers: { "cache-control": CACHE_CONTROL } });
}

/**
 * 502, not a 200 of nulls: this handler is a gateway and its upstream failed,
 * and `Conditions` says why that must not be published in the shape of a
 * reading. Vercel caches no 502 at all, so `no-store` costs nothing here.
 */
function unavailable(): Response {
  return Response.json(
    { error: "upstream_unavailable" },
    { status: 502, headers: { "cache-control": "no-store" } },
  );
}
