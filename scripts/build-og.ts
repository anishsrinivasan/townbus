#!/usr/bin/env bun
/**
 * `bun run og`
 *
 * Lays the title lockup over the OG base plate and writes the share card to
 * `apps/web/public/assets/og.jpg`.
 *
 * The base is a dedicated 1200×630 still kept in `src/public/assets`, where
 * Next will not serve it — only the composed card lands in `public/`. Keeping
 * it separate from the backdrop stills means the card can be art-directed for
 * the crop it actually appears in (a wide, small thumbnail) rather than being a
 * lucky region of a 16:9 backdrop.
 *
 * The Tamil here is real type rendered by librsvg through sharp — never an
 * image model, which mangles Tamil glyphs (PRD §3).
 */

import { mkdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const BASE = join(ROOT, "apps/web/src/public/assets/og-base.jpg");
const OUT = join(ROOT, "apps/web/public/assets/og.jpg");
const FONT_DIR = join(ROOT, "apps/web/src/fonts");

const WIDTH = 1200;
const HEIGHT = 630;

/** Facebook and X both re-encode above ~300 KB; stay under it. */
const BUDGET_BYTES = 300 * 1024;

const TITLE_TA = "டவுன் பஸ் ஹிட்ஸ்";
const TITLE_EN = "TOWN BUS HITS";

/**
 * librsvg resolves SVG `font-family` through fontconfig, which only sees fonts
 * installed on the machine. Pointing it at the repo's own TTFs is what keeps
 * the card's Tamil identical on a Mac and on a Linux CI box.
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
const sharp = (await import("sharp")).default;

/**
 * `paint-order: stroke` draws the outline behind the fill, so the stroke reads
 * as a dark keyline hugging the glyphs instead of eating into them. That is
 * what keeps the lockup legible over a busy, unpredictable photo — the card is
 * shown at thumbnail size in feeds, with no scrim to help.
 */
const overlay = Buffer.from(
  `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .ta { font-family: "Baloo Thambi 2"; font-weight: 800; font-size: 110px; fill: #fff;
          paint-order: stroke; stroke: #0a1f2e; stroke-width: 6px;
          stroke-linejoin: round; }
    /* Catamaran, not Baloo: Baloo's Latin is a rounded display face and the
       subtitle came out looking like a cartoon next to the Tamil. This is the
       same pairing the on-page lockup uses. */
    .en { font-family: "Catamaran"; font-weight: 800; font-size: 32px;
          fill: #f5c26b; letter-spacing: 8px;
          paint-order: stroke; stroke: #0a1f2e; stroke-width: 4px;
          stroke-linejoin: round; }
  </style>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="black" opacity="0.22"/>
  <text x="50%" y="46%" text-anchor="middle" class="ta">${TITLE_TA}</text>
  <!-- Letter-spacing adds a trailing gap, so nudge back by half of it to sit
       optically centred under the Tamil. -->
  <text x="${WIDTH / 2 - 4}" y="60%" text-anchor="middle" class="en">${TITLE_EN}</text>
</svg>`,
);

async function main() {
  const source = Bun.file(BASE);
  if (!(await source.exists())) {
    throw new Error(`No OG base plate at ${BASE}`);
  }

  await mkdir(dirname(OUT), { recursive: true });

  const buffer = await sharp(BASE)
    // `cover` rather than a plain resize: the base is 1200×632, and squashing
    // it to 630 would distort the plate rather than trim two rows off it.
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 82, mozjpeg: true, progressive: true })
    .toBuffer();

  await Bun.write(OUT, buffer);

  const kb = buffer.byteLength / 1024;
  const baseSize = (await stat(BASE)).size / 1024;
  console.log(
    `\nog-base.jpg  ${baseSize.toFixed(0).padStart(5)} KB  →  og.jpg  ${kb.toFixed(0)} KB`,
  );

  if (buffer.byteLength > BUDGET_BYTES) {
    console.error(`\n✗ over the ${BUDGET_BYTES / 1024} KB budget — lower the JPEG quality\n`);
    process.exit(1);
  }

  console.log(
    `✓ share card written to apps/web/public/assets/og.jpg (under ${BUDGET_BYTES / 1024} KB)\n`,
  );
}

await main();
