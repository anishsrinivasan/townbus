/**
 * URL builders for the artwork YouTube already serves for every video. We never
 * host or re-encode label artwork ourselves — these are just the canonical
 * thumbnail endpoints, spelled out in one place.
 */

export type ThumbnailQuality = "default" | "mqdefault" | "hqdefault" | "maxresdefault";

export function thumbnailUrl(youtubeId: string, quality: ThumbnailQuality = "hqdefault"): string {
  return `https://i.ytimg.com/vi/${youtubeId}/${quality}.jpg`;
}

/**
 * `maxresdefault` is 1280×720 but only exists for videos uploaded above 720p —
 * plenty of 90s rips are not. `hqdefault` (480×360) always exists, so it is the
 * fallback rather than the other way around.
 */
export function coverSources(youtubeId: string): { primary: string; fallback: string } {
  return {
    primary: thumbnailUrl(youtubeId, "maxresdefault"),
    fallback: thumbnailUrl(youtubeId, "hqdefault"),
  };
}

/* ---------------------------------------------------------------- covers --
 * Square covers baked at build time by `bun run covers` and served from our own
 * origin. The filename here is the contract between that script and the record
 * in the player card.
 *
 * Exactly one file per track — one size, one format. A responsive matrix of
 * sizes × formats would be hundreds of files in the repo to serve a disc that
 * is never bigger than about 76 CSS px. 256px covers that at 3x, and WebP is
 * supported everywhere that can run the rest of this page.
 */

export const COVER_SIZE = 256;
export const COVER_FORMAT = "webp";

/** e.g. `i1BqRYMFS08.webp` */
export function coverFile(youtubeId: string): string {
  return `${youtubeId}.${COVER_FORMAT}`;
}

export function coverUrl(youtubeId: string, base = "/covers"): string {
  return `${base}/${coverFile(youtubeId)}`;
}

export function watchUrl(youtubeId: string): string {
  return `https://www.youtube.com/watch?v=${youtubeId}`;
}
