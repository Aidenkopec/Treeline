import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Not environment-aware: Vercel already sends X-Robots-Tag: noindex on preview URLs. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
