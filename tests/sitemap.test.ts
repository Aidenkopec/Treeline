import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { readManifest } from "@/lib/manifest";
import { SITE_URL } from "@/lib/site";

/**
 * `readManifest` answers a missing or malformed file with an empty manifest,
 * which is right for a page — it 404s visibly — and wrong here, where it would
 * ship a sitemap listing the home page alone and a green build.
 */

describe("the sitemap", () => {
  it("carries the home page and every baked resort", async () => {
    const manifest = await readManifest();

    expect(manifest.resorts.length).toBeGreaterThan(0);
    expect(await sitemap()).toHaveLength(manifest.resorts.length + 1);
  });

  it("advertises no URL that would 404", async () => {
    const baked = new Set((await readManifest()).resorts.map((resort) => resort.slug));

    for (const entry of await sitemap()) {
      if (entry.url === SITE_URL) continue;
      expect(baked).toContain(entry.url.slice(`${SITE_URL}/resorts/`.length));
    }
  });

  it("dates each entry from the bake rather than the clock", async () => {
    const dates = (await readManifest()).resorts.map((resort) => resort.baked_at);

    for (const entry of (await sitemap()).slice(1)) {
      expect(dates).toContain(entry.lastModified);
    }
  });
});

describe("robots", () => {
  it("points at a sitemap on the same origin the metadata claims", () => {
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});
