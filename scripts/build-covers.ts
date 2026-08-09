#!/usr/bin/env bun
/**
 * `bun run covers`
 *
 * Pulls the YouTube thumbnail for every track and bakes it into one square
 * cover per track at `apps/web/public/covers/{youtubeId}.webp`.
 *
 * Why local rather than hotlinking i.ytimg.com — PRD §5 offers both and this is
 * the better half of the choice:
 *   · one origin, so no third-party connection is opened before first paint
 *   · a real square crop instead of a 4:3 thumbnail letterboxed into a circle
 *   · one small WebP we control rather than ~30 KB of JPEG we do not
 *   · immune to ytimg URL or policy changes, and cached at the edge with the
 *     rest of the static site
 * These are the thumbnails YouTube already serves for the exact videos the page
 * embeds, fetched once at build time — not scraped label artwork (PRD §5).
 *
 * Idempotent and resumable: raw downloads are cached under `.cache/covers/`, so
 * re-runs after adding a few tracks only fetch the new ones.
 */

import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
// Every authored track, not just the slice inside the current year cap —
// raising the cap must not leave newly-shipped tracks without a cover.
import { allTracks as tracks } from "@townbus/content";
import { COVER_SIZE, coverFile } from "@townbus/engine";
import sharp from "sharp";

const ROOT = new URL("..", import.meta.url).pathname;
const OUT_DIR = join(ROOT, "apps/web/public/covers");
const CACHE_DIR = join(ROOT, ".cache/covers");

const CONCURRENCY = 6;

/**
 * Thumbnail qualities, best first. `maxresdefault` is a clean 16:9 frame but
 * only exists for videos uploaded above 720p, which plenty of 90s rips were
 * not. `sddefault` (640×480) and `hqdefault` (480×360) always exist but are
 * 4:3 — a 16:9 picture with letterbox bars — so the bars come off before the
 * square crop, or every cover would be a black-banded stripe.
 */
const SOURCES = ["maxresdefault", "sddefault", "hqdefault"] as const;

/**
 * The 16:9 picture inside a thumbnail, derived from the actual dimensions
 * rather than hard-coded per quality — YouTube has changed thumbnail sizes
 * before, and a wrong constant here is an `extract_area` crash at best and a
 * silently mis-cropped cover at worst. Anything already 16:9 or wider is
 * returned untouched.
 */
function innerFrame(width: number, height: number) {
  const target = Math.round((width * 9) / 16);
  if (height <= target + 2) return null;
  return { left: 0, width, top: Math.round((height - target) / 2), height: target };
}

type Fetched = { buffer: Buffer; source: string };

async function download(youtubeId: string): Promise<Fetched | null> {
  for (const source of SOURCES) {
    const cached = join(CACHE_DIR, `${youtubeId}-${source}.jpg`);
    const file = Bun.file(cached);

    let buffer: Buffer | null = null;
    if (await file.exists()) {
      buffer = Buffer.from(await file.arrayBuffer());
    } else {
      const response = await fetch(`https://i.ytimg.com/vi/${youtubeId}/${source}.jpg`, {
        signal: AbortSignal.timeout(15_000),
      }).catch(() => null);
      // A missing maxres is a 404; YouTube also serves a 120×90 grey placeholder
      // for some misses, which the size check below catches.
      if (!response?.ok) continue;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength < 2_000) continue;
      await Bun.write(cached, bytes);
      buffer = bytes;
    }

    if (!buffer) continue;

    const { width = 0, height = 0 } = await sharp(buffer).metadata();
    if (width < 320) continue;

    // Cut the letterbox bars, then hand back a clean 16:9 frame.
    const frame = innerFrame(width, height);
    const cropped = frame ? await sharp(buffer).extract(frame).toBuffer() : buffer;

    return { buffer: cropped, source };
  }

  return null;
}

/** One square WebP per track — see the note on `coverFile` in the engine. */
async function encode(youtubeId: string, buffer: Buffer): Promise<number> {
  const encoded = await sharp(buffer)
    .resize(COVER_SIZE, COVER_SIZE, { fit: "cover", position: "attention" })
    .webp({ quality: 74, effort: 5 })
    .toBuffer();

  await Bun.write(join(OUT_DIR, coverFile(youtubeId)), encoded);
  return encoded.byteLength;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(CACHE_DIR, { recursive: true });

  console.log(`\nbuilding covers for ${tracks.length} tracks\n`);

  const missing: string[] = [];
  const bySource = new Map<string, number>();
  let totalBytes = 0;
  let cursor = 0;
  let done = 0;

  const worker = async () => {
    while (cursor < tracks.length) {
      const track = tracks[cursor++];
      if (!track) continue;

      const fetched = await download(track.youtubeId);
      done++;

      if (!fetched) {
        missing.push(`${track.youtubeId}  ${track.title} — ${track.movie}`);
        continue;
      }

      totalBytes += await encode(track.youtubeId, fetched.buffer);
      bySource.set(fetched.source, (bySource.get(fetched.source) ?? 0) + 1);
      if (done % 20 === 0) console.log(`  ${done}/${tracks.length}`);
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  for (const [source, count] of [...bySource].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(4)} from ${source}`);
  }

  if (missing.length > 0) {
    console.error(`\n✗ no usable thumbnail for ${missing.length} track(s):`);
    for (const line of missing) console.error(`  ${line}`);
    process.exit(1);
  }

  const files = (await readdir(OUT_DIR)).length;

  console.log(
    `\n✓ ${files} covers, ${(totalBytes / 1024).toFixed(0)} KB total ` +
      `(~${Math.round(totalBytes / tracks.length / 1024)} KB each)\n`,
  );
}

await main();
