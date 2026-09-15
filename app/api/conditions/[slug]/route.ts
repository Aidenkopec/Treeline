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

/** A visitor is waiting. Long enough for a normal answer, short enough to give up on. */
const UPSTREAM_TIMEOUT_MS = 4000;

/**
 * 900s is Open-Meteo's own update interval (`current.interval`), so asking more
 * often than that returns the same numbers. `stale-if-error` is what makes an
 * outage degrade into the last real reading rather than into nothing at all —
 * which is the job a 200 full of nulls would otherwise have been given.
 */
const CACHE_CONTROL = "public, s-maxage=900, stale-while-revalidate=3600, stale-if-error=86400";

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
 * 502, not a 200 of nulls. This handler is a gateway and its upstream failed;
 * answering with a well-formed reading of nulls would make "Open-Meteo is down"
 * indistinguishable from "no snow fell", and at a ski resort those are opposite
 * facts. The page still never blanks: the strip renders a dash for a failed
 * response exactly as it does for a field the model does not carry.
 */
function unavailable(): Response {
  return Response.json(
    { error: "upstream_unavailable" },
    { status: 502, headers: { "cache-control": "no-store" } },
  );
}
