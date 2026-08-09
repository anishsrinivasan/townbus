import "@townbus/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: the whole site is HTML/CSS/JS on Cloudflare's edge. There is
  // no backend in v1 — the playlist is a TypeScript file in git.
  output: "export",
  typedRoutes: true,
  reactCompiler: true,
  images: {
    // No image optimiser exists in a static export; the backdrop matrix is
    // pre-encoded by `bun run assets` and cover art comes straight from ytimg.
    unoptimized: true,
  },
};

export default nextConfig;
