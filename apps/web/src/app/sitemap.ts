import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** Required under `output: "export"` — there is no server to revalidate on. */
export const dynamic = "force-static";

/**
 * Emitted as a static `sitemap.xml` at build time.
 *
 * One page, because that is the whole product. The deep links from PRD §9 P1
 * (`?t={youtubeId}`) are query strings on this same page, not routes, so they
 * do not belong here — listing them would be asking search engines to index a
 * hundred near-identical copies of one page.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: site.url,
      // Static export has no request-time clock, and a build-time `new Date()`
      // would claim the content changed on every deploy. The playlist changes
      // when `tracks.ts` changes, which is what a curation PR records.
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
