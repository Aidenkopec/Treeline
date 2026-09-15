import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/conditions/[slug]/route";
import lakeLouise from "./fixtures/open-meteo-lake-louise.json" with { type: "json" };

/**
 * SPEC §11 phase 4: "tests against recorded Open-Meteo fixtures, including an
 * API-down case". The mapping is tested against the fixtures in
 * tests/conditions.test.ts; what is left here is what the handler does when the
 * other end of the call does not behave — which is the half that cannot be
 * proved with a fixture alone, and the only place in this project that stubs
 * the network.
 */

afterEach(() => vi.unstubAllGlobals());

function stubFetch(impl: (...args: Parameters<typeof fetch>) => Promise<Response>) {
  const spy = vi.fn(impl);
  vi.stubGlobal("fetch", spy);
  return spy;
}

function call(slug: string) {
  return GET(new Request(`http://localhost/api/conditions/${slug}`), {
    params: Promise.resolve({ slug }),
  });
}

describe("a resort Open-Meteo answers for", () => {
  it("returns the mapped reading", async () => {
    stubFetch(async () => Response.json(lakeLouise));

    const response = await call("lake-louise");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      slug: "lake-louise",
      observed_at: "2026-09-15T21:00:00.000Z",
      timezone: "America/Edmonton",
      temperature_c: 6.6,
      snowfall_cm_24h: 0,
      snow_depth_cm: 0,
      wind_kph: 13.2,
      wind_direction_deg: 133,
    });
  });

  it("lets the edge hold it for Open-Meteo's own update interval", async () => {
    stubFetch(async () => Response.json(lakeLouise));

    const cacheControl = (await call("lake-louise")).headers.get("cache-control");

    expect(cacheControl).toContain("s-maxage=900");
    expect(cacheControl).toContain("stale-while-revalidate=3600");
    // The reason a failed upstream can be a 502 rather than a body of nulls:
    // a cache with a recent reading keeps serving that instead.
    expect(cacheControl).toContain("stale-if-error=86400");
  });

  it("asks about the coordinates committed in resorts.json, and gives up on them", async () => {
    const spy = stubFetch(async () => Response.json(lakeLouise));

    await call("lake-louise");

    const [url, init] = spy.mock.calls[0];
    const asked = new URL(url as string);
    expect(asked.origin + asked.pathname).toBe("https://api.open-meteo.com/v1/forecast");
    expect(asked.searchParams.get("latitude")).toBe("51.4419");
    expect(asked.searchParams.get("longitude")).toBe("-116.1622");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});

/**
 * The slug is the only caller-supplied value anywhere near an outbound request.
 * Answering an unknown one before the fetch is what keeps this from being a
 * proxy that can be pointed at an arbitrary latitude and longitude.
 */
describe("a slug this project does not ship", () => {
  it("is 404, and nothing is asked of anyone", async () => {
    const spy = stubFetch(async () => Response.json(lakeLouise));

    const response = await call("whistler");

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(spy).not.toHaveBeenCalled();
  });

  it("refuses a slug shaped like an injected parameter", async () => {
    const spy = stubFetch(async () => Response.json(lakeLouise));

    expect((await call("lake-louise&latitude=0")).status).toBe(404);
    expect((await call("../../etc/passwd")).status).toBe(404);
    expect(spy).not.toHaveBeenCalled();
  });
});

/**
 * The API-down case the phase gate names. Every one of these is 502 rather than
 * a 200 carrying a Conditions of nulls: the handler is a gateway whose upstream
 * failed, and "Open-Meteo is down" must not be published in the same shape as
 * "no snow fell". The strip renders a dash either way, so the page still holds.
 */
describe("Open-Meteo not answering", () => {
  it("is 502 when the connection fails outright", async () => {
    stubFetch(async () => {
      throw new TypeError("fetch failed");
    });

    const response = await call("lake-louise");

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "upstream_unavailable" });
    // Never cache an outage: the next visitor should get a real attempt.
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("is 502 when the request times out", async () => {
    stubFetch(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });

    expect((await call("lake-louise")).status).toBe(502);
  });

  it("is 502 when Open-Meteo is up but unwell", async () => {
    for (const status of [429, 500, 503]) {
      stubFetch(async () => new Response("", { status }));
      expect((await call("lake-louise")).status).toBe(502);
      vi.unstubAllGlobals();
    }
  });

  it("is 502 when a 200 carries something that is not JSON", async () => {
    stubFetch(async () => new Response("<html>502 Bad Gateway</html>", { status: 200 }));

    expect((await call("lake-louise")).status).toBe(502);
  });

  it("is 502 when a 200 carries an Open-Meteo error instead of a reading", async () => {
    stubFetch(async () => Response.json({ error: true, reason: "No data available" }));

    const response = await call("lake-louise");

    expect(response.status).toBe(502);
    // The reason it must not be a 200: this body would otherwise have been
    // published as a reading with every number missing.
    expect(await response.json()).toEqual({ error: "upstream_unavailable" });
  });
});
