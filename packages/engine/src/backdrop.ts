/**
 * Resolves which of the four background stills to serve. The matrix is
 * period × orientation; encoding lives in `scripts/build-assets.ts` and the
 * filenames here are the contract between that script and the renderer.
 */

import type { Period } from "./period";

export type Orientation = "landscape" | "portrait";
export type BackdropSize = "full" | "half";
export type BackdropFormat = "avif" | "webp" | "jpg";

export const BACKDROP_FORMATS: readonly BackdropFormat[] = ["avif", "webp", "jpg"];
export const BACKDROP_SIZES: readonly BackdropSize[] = ["full", "half"];

export const BACKDROP_VARIANTS: readonly { period: Period; orientation: Orientation }[] = [
  { period: "morning", orientation: "landscape" },
  { period: "morning", orientation: "portrait" },
  { period: "night", orientation: "landscape" },
  { period: "night", orientation: "portrait" },
];

/** e.g. `bg-night-portrait-half.avif` */
export function backdropFile(
  period: Period,
  orientation: Orientation,
  size: BackdropSize,
  format: BackdropFormat,
): string {
  return `bg-${period}-${orientation}-${size}.${format}`;
}

export function backdropUrl(
  period: Period,
  orientation: Orientation,
  size: BackdropSize,
  format: BackdropFormat,
  base = "/assets",
): string {
  return `${base}/${backdropFile(period, orientation, size, format)}`;
}

/** Source filename of the un-encoded Magnific still, keyed the same way. */
export function backdropSourceName(period: Period, orientation: Orientation): string {
  return `bg-${period}-${orientation}`;
}

/* ------------------------------------------------------------------ loops --
 * Video backdrops (PRD §9 P2). Same period × orientation matrix as the stills,
 * which double as their posters, so a loop can never be the only thing
 * standing between a visitor and a backdrop.
 */

export type BackdropVideoFormat = "webm" | "mp4";

/**
 * H.264 only, deliberately. The sources are already H.264, and re-encoding them
 * to VP9 came out roughly twice the size at matched quality — so the webm would
 * be a larger file that only some browsers download. The type keeps `webm` so a
 * future AV1 or better-tuned VP9 pass can be added without a schema change.
 */
export const BACKDROP_VIDEO_FORMATS: readonly BackdropVideoFormat[] = ["mp4"];

/** e.g. `bg-night-portrait.webm` */
export function backdropVideoFile(
  period: Period,
  orientation: Orientation,
  format: BackdropVideoFormat,
): string {
  return `${backdropSourceName(period, orientation)}.${format}`;
}

export function backdropVideoUrl(
  period: Period,
  orientation: Orientation,
  format: BackdropVideoFormat,
  base = "/assets/videos",
): string {
  return `${base}/${backdropVideoFile(period, orientation, format)}`;
}
