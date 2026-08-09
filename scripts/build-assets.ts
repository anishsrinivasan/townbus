#!/usr/bin/env bun
/**
 * `bun run assets`
 *
 * Turns the four 4096px Magnific stills in `apps/web/src/public/assets` into the
 * served backdrop matrix in `apps/web/public/assets`, plus the OG card.
 *
 * The sources are ~13 MB PNGs and deliberately live under `src/`, where Next
 * will never serve them — only the encoded output lands in `public/`.
 *
 * Output per still: {full, half} × {avif, webp, jpg}. Quality is tuned down
 * until the largest served variant fits the 350 KB budget from PRD §6; these
 * are backdrops sitting behind a scrim, so they can take the compression.
 */

import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SOURCE_DIR = join(ROOT, "apps/web/src/public/assets");
const VIDEO_SOURCE_DIR = join(SOURCE_DIR, "videos");
const OUT_DIR = join(ROOT, "apps/web/public/assets");
const VIDEO_OUT_DIR = join(OUT_DIR, "videos");
const FONT_DIR = join(ROOT, "apps/web/src/fonts");

/**
 * librsvg resolves SVG `font-family` through fontconfig, which only sees fonts
 * installed on the machine. Pointing it at the repo's own TTFs is what keeps
 * the OG card's Tamil identical on a Mac and on a Linux CI box — and keeps the
 * Tamil real type rather than anything an image model drew (PRD §3).
 */
async function registerRepoFonts() {
  const configDir = join(tmpdir(), "townbus-fontconfig");
  await mkdir(configDir, { recursive: true });
  await writeFile(
    join(configDir, "fonts.conf"),
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>${FONT_DIR}</dir>
  <dir>/System/Library/Fonts</dir>
  <dir>/usr/share/fonts</dir>
  <cachedir>${join(configDir, "cache")}</cachedir>
</fontconfig>`,
  );
  process.env.FONTCONFIG_FILE = join(configDir, "fonts.conf");
  process.env.FONTCONFIG_PATH = configDir;
}

await registerRepoFonts();

// Imported after fontconfig is pointed at the repo fonts — sharp initialises
// librsvg (and its font set) on first load.
const {
  BACKDROP_VARIANTS,
  BACKDROP_VIDEO_FORMATS,
  backdropFile,
  backdropSourceName,
  backdropVideoFile,
} = await import("@townbus/engine");
const sharp = (await import("sharp")).default;

/** Long edge in px. Half is what phones and mid-DPI laptops actually get. */
const SIZES = { full: 2560, half: 1280 } as const;

const QUALITY = {
  avif: { full: 45, half: 50 },
  webp: { full: 62, half: 68 },
  jpg: { full: 68, half: 74 },
} as const;

const BUDGET_BYTES = 350 * 1024;

const OG = {
  width: 1200,
  height: 630,
  title: "டவுன் பஸ் ஹிட்ஸ்",
  subtitle: "TOWN BUS HITS",
  caption: "Tamil kuthu, gaana &amp; melody · 1985–2010",
};

async function encodeVariant(
  sourcePath: string,
  period: (typeof BACKDROP_VARIANTS)[number]["period"],
  orientation: (typeof BACKDROP_VARIANTS)[number]["orientation"],
) {
  const rows: { file: string; kb: number }[] = [];

  for (const size of ["full", "half"] as const) {
    const longEdge = SIZES[size];
    // Portrait stills are taller than wide, so the long edge is the height.
    const resize =
      orientation === "portrait"
        ? { height: longEdge, width: undefined }
        : { width: longEdge, height: undefined };

    const base = sharp(sourcePath).resize({ ...resize, fit: "inside", withoutEnlargement: true });

    for (const format of ["avif", "webp", "jpg"] as const) {
      const name = backdropFile(period, orientation, size, format);
      const target = join(OUT_DIR, name);
      const pipeline = base.clone();

      const buffer =
        format === "avif"
          ? await pipeline.avif({ quality: QUALITY.avif[size], effort: 6 }).toBuffer()
          : format === "webp"
            ? await pipeline.webp({ quality: QUALITY.webp[size], effort: 6 }).toBuffer()
            : await pipeline
                .jpeg({ quality: QUALITY.jpg[size], mozjpeg: true, progressive: true })
                .toBuffer();

      await Bun.write(target, buffer);
      rows.push({ file: name, kb: buffer.byteLength / 1024 });
    }
  }

  return rows;
}

/**
 * OG card: a 1200×630 crop of the night landscape with the lockup laid over it.
 * The Tamil is real text rendered by librsvg through sharp — never an image
 * model, which mangles Tamil glyphs (PRD §3).
 */
async function buildOgImage(nightLandscape: string) {
  const scrim = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OG.width}" height="${OG.height}">
      <defs>
        <linearGradient id="veil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0b0705" stop-opacity="0.30"/>
          <stop offset="55%" stop-color="#0b0705" stop-opacity="0.62"/>
          <stop offset="100%" stop-color="#0b0705" stop-opacity="0.88"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#veil)"/>
    </svg>`,
  );

  const lockup = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${OG.width}" height="${OG.height}">
      <style>
        .ta { font-family: "Baloo Thambi 2", "Noto Sans Tamil", "Latha", sans-serif;
              font-size: 108px; font-weight: 800; fill: #ffcf70; }
        .la { font-family: "Catamaran", "Helvetica Neue", sans-serif;
              font-size: 34px; font-weight: 800; letter-spacing: 14px; fill: #f6ece0; }
        .cap { font-family: "Catamaran", "Helvetica Neue", sans-serif;
               font-size: 24px; font-weight: 500; letter-spacing: 2px; fill: #c9b7a6; }
        .off { fill: #a8320f; }
      </style>
      <text class="ta off" x="${OG.width / 2}" y="298" text-anchor="middle">${OG.title}</text>
      <text class="ta" x="${OG.width / 2 - 5}" y="293" text-anchor="middle">${OG.title}</text>
      <text class="la" x="${OG.width / 2}" y="358" text-anchor="middle">${OG.subtitle}</text>
      <text class="cap" x="${OG.width / 2}" y="428" text-anchor="middle">${OG.caption}</text>
    </svg>`,
  );

  const buffer = await sharp(nightLandscape)
    .resize(OG.width, OG.height, { fit: "cover", position: "attention" })
    .composite([
      { input: scrim, top: 0, left: 0 },
      { input: lockup, top: 0, left: 0 },
    ])
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();

  await Bun.write(join(OUT_DIR, "og.jpg"), buffer);
  return buffer.byteLength / 1024;
}

/**
 * Encodes the backdrop loops (PRD §9 P2).
 *
 * The sources land as 5-second 1080p files at ~23 Mbps, which is roughly 14 MB
 * to show a bus swaying behind a scrim. These are downscaled to a 1280px long
 * edge, stripped of audio, and encoded twice — VP9 for browsers that take it,
 * H.264 for everything else — with `faststart` so playback can begin on the
 * first chunk instead of after the whole file.
 */
async function encodeVideos() {
  const sources = await readdir(VIDEO_SOURCE_DIR).catch(() => null);
  if (!sources?.length) {
    console.log("\nno backdrop loops to encode (skipping)");
    return [] as { file: string; kb: number }[];
  }

  await mkdir(VIDEO_OUT_DIR, { recursive: true });
  const rows: { file: string; kb: number }[] = [];

  for (const { period, orientation } of BACKDROP_VARIANTS) {
    const stem = backdropSourceName(period, orientation);
    const match = sources.find((file) => file.startsWith(stem));
    if (!match) continue;

    const input = join(VIDEO_SOURCE_DIR, match);
    // Long edge 1280: landscape 1280×720, portrait 720×1280.
    const scale = orientation === "portrait" ? "scale=720:-2" : "scale=1280:-2";
    console.log(`\n${stem}  ←  ${match}`);

    for (const format of BACKDROP_VIDEO_FORMATS) {
      const name = backdropVideoFile(period, orientation, format);
      const target = join(VIDEO_OUT_DIR, name);

      const args =
        format === "webm"
          ? [
              "-i",
              input,
              "-vf",
              scale,
              "-an",
              "-c:v",
              "libvpx-vp9",
              "-crf",
              "36",
              "-b:v",
              "0",
              "-row-mt",
              "1",
              "-deadline",
              "good",
              "-cpu-used",
              "2",
              "-y",
              target,
            ]
          : [
              "-i",
              input,
              "-vf",
              scale,
              "-an",
              "-c:v",
              "libx264",
              "-crf",
              "30",
              "-preset",
              "slow",
              "-pix_fmt",
              "yuv420p",
              "-movflags",
              "+faststart",
              "-y",
              target,
            ];

      const proc = Bun.spawn(["ffmpeg", "-v", "error", ...args], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const code = await proc.exited;
      if (code !== 0) {
        console.error(`  ✗ ffmpeg failed for ${name}\n${await new Response(proc.stderr).text()}`);
        process.exit(1);
      }

      const { size } = await stat(target);
      rows.push({ file: name, kb: size / 1024 });
      console.log(`  ${name.padEnd(34)} ${(size / 1024).toFixed(0).padStart(5)} KB`);
    }
  }

  return rows;
}

async function main() {
  const sources = await readdir(SOURCE_DIR).catch(() => {
    throw new Error(`No source stills at ${SOURCE_DIR}`);
  });
  await mkdir(OUT_DIR, { recursive: true });

  const rows: { file: string; kb: number }[] = [];

  for (const { period, orientation } of BACKDROP_VARIANTS) {
    const stem = backdropSourceName(period, orientation);
    const match = sources.find((file) => file.startsWith(stem));
    if (!match) throw new Error(`Missing source still: ${stem}.(png|jpg) in ${SOURCE_DIR}`);

    const sourcePath = join(SOURCE_DIR, match);
    const { size } = await stat(sourcePath);
    console.log(`\n${stem}  ←  ${match} (${(size / 1024 / 1024).toFixed(1)} MB)`);

    for (const row of await encodeVariant(sourcePath, period, orientation)) {
      rows.push(row);
      const flag = row.kb * 1024 > BUDGET_BYTES ? "  ✗ over budget" : "";
      console.log(`  ${row.file.padEnd(34)} ${row.kb.toFixed(0).padStart(5)} KB${flag}`);
    }
  }

  const nightLandscape = join(
    SOURCE_DIR,
    sources.find((f) => f.startsWith("bg-night-landscape")) as string,
  );
  const ogKb = await buildOgImage(nightLandscape);
  console.log(`\nog.jpg${" ".repeat(29)}${ogKb.toFixed(0).padStart(5)} KB`);

  const videoRows = await encodeVideos();

  const over = rows.filter((row) => row.kb * 1024 > BUDGET_BYTES);
  if (over.length > 0) {
    console.error(
      `\n✗ ${over.length} variant(s) over the ${BUDGET_BYTES / 1024} KB budget — lower QUALITY in this script`,
    );
    process.exit(1);
  }

  const videoMb = videoRows.reduce((total, row) => total + row.kb, 0) / 1024;
  console.log(
    `\n✓ ${rows.length} backdrop variants + OG card, all under ${BUDGET_BYTES / 1024} KB` +
      (videoRows.length
        ? `\n✓ ${videoRows.length} backdrop loops, ${videoMb.toFixed(1)} MB total`
        : "") +
      "\n",
  );
}

await main();
