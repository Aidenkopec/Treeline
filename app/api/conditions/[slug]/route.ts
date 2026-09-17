import { conditionsUrl, parseConditions } from "@/lib/conditions";
import { plannedResorts } from "@/lib/manifest";

/**
 * The only outbound call this project makes at runtime (SPEC §5). Proxied so the
 * response caches at the edge and a free, keyless upstream is not flooded. It
 * reports snow, temperature and wind; it never says whether to ski (SPEC §8).
 */

const UPSTREAM_TIMEOUT_MS = 4000;

/**
 * 900s is Open-Meteo's own update interval, so polling faster returns the same
 * numbers. `stale-if-error` would be the directive past the stale window, but
 * Vercel does not honour it.
 */
const CACHE_CONTROL = "public, s-maxage=900, stale-while-revalidate=3600";

export async function GET(_request: Request, { params }: RouteContext<"/api/conditions/[slug]">) {
  const { slug } = await params;

  // Only coordinates from resorts.json reach Open-Meteo, so this is not an open proxy.
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
      // No retry inside a request; the cache directives above absorb a blip.
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

/** 502, not a 200 of nulls: an absent reading must not be published in the shape of one. */
function unavailable(): Response {
  return Response.json(
    { error: "upstream_unavailable" },
    { status: 502, headers: { "cache-control": "no-store" } },
  );
}
