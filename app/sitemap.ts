import type { MetadataRoute } from "next";
import { readManifest } from "@/lib/manifest";
import { SITE_URL } from "@/lib/site";

/**
 * The manifest, not resorts.json: a planned but unbaked resort has no page.
 * `baked_at` rather than the clock, so unchanged data gives an unchanged sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const manifest = await readManifest();

  return [
    { url: SITE_URL, lastModified: manifest.generated_at },
    ...manifest.resorts.map((resort) => ({
      url: `${SITE_URL}/resorts/${resort.slug}`,
      lastModified: resort.baked_at,
    })),
  ];
}
