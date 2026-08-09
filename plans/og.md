// scripts/build-og.ts — bun run scripts/build-og.ts
import sharp from "sharp";

const W = 1200, H = 630;
const svg = `
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .ta { font-family: 'Baloo Thambi 2'; font-weight: 800; font-size: 110px; fill: #fff;
          paint-order: stroke; stroke: #0a1f2e; stroke-width: 6px; }
    .en { font-family: 'Baloo Thambi 2'; font-weight: 600; font-size: 34px;
          fill: #f5c26b; letter-spacing: 6px; }
  </style>
  <rect width="${W}" height="${H}" fill="black" opacity="0.22"/>
  <text x="50%" y="46%" text-anchor="middle" class="ta">டவுன் பஸ் ஹிட்ஸ்</text>
  <text x="50%" y="60%" text-anchor="middle" class="en">TOWN BUS HITS</text>
</svg>`;

await sharp("assets/og-base.jpg")           // the CqH1uBqEEy download
  .resize(W, H)
  .composite([{ input: Buffer.from(svg) }])
  .jpeg({ quality: 82 })                     // OG must be jpg/png, keep < 300KB
  .toFile("apps/web/public/og.jpg");