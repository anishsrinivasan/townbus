# PRD — BusPaattu (டவுன் பஸ் ஹிட்ஸ்)

**Status:** Ready for Claude Code · **Owner:** Anish · **Class:** Craft/reputation project (Cockpit pattern — no moat/monetization requirements; success = adoption + people sharing it)
**Reference product:** https://saloon.wtf/ (Deluxe Saloon — 90s Bollywood barber-shop songs)

---

## 1. Problem Statement

Tamil Nadu town buses have a distinct sonic identity: kuthu, gaana, and melody tracks played through blown speakers over engine noise, roughly 1985–2010. This shared memory has no dedicated home on the web. saloon.wtf proved the format (curated nostalgia playlist + evocative single-page shell + live social proof) works and spreads organically. BusPaattu is the Tamil town-bus version, in an original visual style.

The product is **curation + atmosphere**. Engineering is deliberately minimal.

## 2. Goals

1. Ship a static v1 (no backend) within one weekend of Claude Code time.
2. 40+ curated tracks at launch that pass the inclusion filter (§7).
3. Site feels alive and period-correct: day/night background swap, painterly art, Tamil-script title.
4. Fully usable on mobile portrait — not a cropped desktop page.
5. Organic sharing: the page is screenshot-worthy and link-forwardable without explanation.

## 3. Non-Goals

- **No audio hosting.** Ever. All playback via YouTube IFrame Player API (licensed infra). One-commit fallback: link-out-only mode (embedded Spotify/YT Music playlists).
- **No backend in v1.** Listener count (Durable Object + WebSocket) is Phase 2.
- **No video loops in v1.** Stills only; video generation happens later (assets §6 are the keyframe sources).
- **No user accounts, comments, submissions.** Curation is PR-based via `tracks.ts`.
- **No monetization.** Craft project.
- **No MTC/TNSTC names, logos, or exact livery.** State transport corporations are government entities; stylize, never reproduce.
- **No AI-generated Tamil script anywhere.** Image models mangle Tamil glyphs. All Tamil text is real HTML type.

## 4. Naming & Branding

- Working name: **BusPaattu** — check `buspaattu.com` / `buspaattu.fm` availability before scaffold. Backups: `townbus.fm`, `kadaisiseat.com`.
- Title lockup (HTML text, not image):
  - Primary: **டவுன் பஸ் ஹிட்ஸ்** — heavy Tamil display face: Baloo Thambi 2 or Catamaran (Black weight), via Google Fonts / self-hosted woff2.
  - Secondary: "Town Bus Hits" small beneath, Latin.
  - Hand-painted-bus-lettering feel via CSS: hard offset `text-shadow` (poster print offset), subtle grain overlay on the hero container, slight per-letter rotation optional. Text stays selectable and SEO-visible.

## 5. Architecture

Static site, Turborepo monorepo, standard stack (Bun, TypeScript, Biome, Lefthook, Vitest, Changesets).

```
apps/web                    Vite + React, deployed to Cloudflare (static assets only in v1)
packages/engine             PURE. Queue, shuffle (seeded), next/prev, track model,
                            day/night resolver. Zero network, zero framework, zero DOM.
                            Vitest + Bun test against fixtures.
packages/adapters/
  youtube/                  IFrame Player API wrapper (load, play, pause, seek, onEnd → engine.next)
  links/                    Spotify / YT Music playlist URL builders (link-out only)
packages/content/           tracks.ts — typed track list. Content-as-code, PR-curated.
```

Engine/renderer separation is absolute: `packages/engine` must run offline against fixtures. All YouTube specifics live in the adapter seam.

**No D1, no Drizzle, no Workers logic in v1.** The track list is a TS file in git.

### Track model

```ts
type Track = {
  youtubeId: string;        // 11-char video ID; also keys cover art at /covers/{id}.jpg
  title: string;            // Latin transliteration
  titleTa: string;          // தமிழ் — required, half the emotional payload
  movie: string;
  year: number;
  composer: string;         // Deva, Vidyasagar, Yuvan, Srikanth Deva, Ilaiyaraaja...
  era: "80s" | "90s" | "2000s";
  vibe: "kuthu" | "gaana" | "melody" | "folk";
};
```

### YouTube playback constraints (legal/ToS — treat as hard requirements)

- Player must be **visible and unobscured** (YouTube ToS). No 1px/hidden iframe. Frame the visible player as a design element — a small "cassette deck window" card works with the aesthetic.
- Autoplay only after user gesture (browser policy anyway). First interaction = tap the play button.
- Cover art: use YouTube thumbnail URLs (`i.ytimg.com/vi/{id}/hqdefault.jpg`) or fetch-and-cache at build time. Do not scrape/host label artwork separately.
- If a video becomes unavailable (`onError` codes 100/101/150), engine skips to next and logs the ID to console; a CI script (`bun run check-tracks`) validates all IDs via oEmbed endpoint.

## 6. Visual Assets (already generated — Magnific)

4-asset matrix, all 2x-upscaled (creative / ArtAndIllustration), painterly 1990s Tamil-film-poster grade. Download from Magnific library by identifier:

apps/web/src/public/assets

| Asset | Magnific identifier | File |
|---|---|---|
| Morning · landscape 16:9 | `s7wPSFrl8e` | `bg-morning-landscape` |
| Night · landscape 16:9 | `xSgJsHXjfW` | `bg-night-landscape` |
| Morning · portrait 9:16 | `MBXtdLKDCm` | `bg-morning-portrait` |
| Night · portrait 9:16 | `1lswLTQr4r` | `bg-night-portrait` |

Build pipeline: encode each to AVIF + WebP + JPEG at 2 sizes (full, half) via `sharp` in a build script. Target < 350 KB for the largest served variant.

**Day/night swap:** resolver lives in `packages/engine` (pure function of an injected `Date` in IST): morning asset 05:00–17:59 IST, night otherwise. Rendered via `<picture>`:
- `(orientation: portrait)` → portrait asset for current period
- else → landscape asset
No JS flash: SSR-less static page picks initial asset via inline script before paint, or accept one repaint.

**OG image:** 1200×630 crop of the night landscape (cassette-deck region visible) with title overlaid — done in the build script with `sharp` + SVG text overlay, not generated.

**Design tokens:** extract OKLCH palette from the night landscape via tweakcn. `--primary` sodium amber, `--secondary` deep teal, `--accent` rust red. shadcn on Base UI.

## 7. Curation (the actual product)

**Inclusion filter:** the song must be one you'd hear *distorted through a blown speaker over engine noise* on a TN town bus — not merely a good song of the era. Era scope: **1985–2010, 90s kuthu as the core.**

Claude Code research task for the candidate list:
- Mine YouTube compilation playlists ("Tamil bus songs", "kuthu songs 90s", "gaana hits") — **comments over video contents**; comments are where people name what they remember.
- Composer spines: Deva (primary), Ilaiyaraaja late-80s kuthu, Vidyasagar, Yuvan, Srikanth Deva; gaana tracks (Chennai gaana crossover era).
- Output: 60–80 candidates in `tracks.candidates.ts` with all fields filled; Anish prunes to 40+ finals.
- CI: `bun run check-tracks` validates every `youtubeId` resolves via YouTube oEmbed.

## 8. UI Spec

Single page.

**Desktop (landscape):** full-bleed background (current period), title lockup upper-center, listener-count slot upper area (Phase 2 — render nothing in v1, keep the layout slot), Spotify / YT Music link-outs top-right, player card bottom-center: cover art, title (Tamil above Latin), movie · year · composer, prev/play/next, seek bar with elapsed/total. Visible YouTube iframe rendered as a small framed element within or adjacent to the player card.

**Mobile (portrait):** portrait background; player card bottom-anchored full-width; title lockup scales down; link-outs collapse into a single row. Touch targets ≥ 44px. Keyboard controls (space = play/pause, ←/→ = prev/next) desktop-only.

**Motion:** none in v1 beyond micro-transitions. `prefers-reduced-motion` respected from day one (matters when video loops arrive in Phase 3).

## 9. Requirements

### P0 — v1 does not ship without
- [ ] Engine package: queue, seeded shuffle, next/prev/onEnd, day/night resolver — 100% offline-tested
- [ ] YouTube adapter: visible player, play/pause/seek, error-skip (100/101/150)
- [ ] 40+ curated tracks in `tracks.ts` with Tamil titles, all IDs CI-validated
- [ ] 4-asset background matrix wired via `<picture>` + IST period resolver
- [ ] Tamil HTML title lockup with painted-lettering CSS treatment
- [ ] Mobile portrait layout as specified
- [ ] OG image + full meta tags (og:, twitter:) generated at build
- [ ] Deployed to Cloudflare on the chosen domain

### P1 — fast follows
- [ ] Live listener count: one Durable Object holding a WebSocket connection set (Phase 2, first backend code)
- [ ] Shareable deep links `?t={youtubeId}`
- [ ] Spotify + YT Music mirror playlists (manual creation; site links out)
- [ ] Era/vibe filter chips

### P2 — architectural insurance only
- [ ] Video loop backgrounds (desktop landscape only; stills from §6 as start keyframes; generated later via Magnific `video_plan`)
- [ ] Track-of-the-day rotation for OG image

## 10. Acceptance Criteria (key paths)

- Given first load on desktop at 20:00 IST, when the page paints, then the night landscape background and Tamil title are visible and no audio plays.
- Given the user taps play, when the current track ends, then the engine advances and the next track plays without further interaction.
- Given a track's YouTube ID is dead, when the player fires error 100/101/150, then playback skips to the next track within 2s.
- Given a portrait phone, when the page loads, then the portrait asset is served (no landscape crop) and the player card is bottom-anchored full-width.
- Given JS disabled, then the page still shows title, artwork, and Spotify/YT Music links (progressive degradation to link-out mode).
- Given any viewport, then no Tamil text on the page originates from a raster image.

## 11. Success Metrics

Leading (first month): 500 unique visitors; median session > 3 minutes (people listen, not bounce); ≥ 30% mobile sessions completing a play.
Lagging: unprompted shares (Twitter/X, WhatsApp forwards — the actual distribution channel for this audience); PRs or issues suggesting tracks (signal the curation loop works).

## 12. Open Questions

- **Anish (blocking):** final domain — buspaattu.com/.fm vs alternates. Needed before deploy config.
- **Anish (non-blocking):** seed list — any 15–20 songs already in your head to anchor the candidate research.
- **Claude Code (non-blocking, resolve during build):** whether YouTube thumbnails at `hqdefault` are acceptable quality for the player card or `maxresdefault` with fallback is worth the extra check.

## 13. Build Order (Claude Code)

1. Scaffold: `bun create better-t-stack@latest` → Turborepo shape per §5; Biome, Lefthook, Vitest, Changesets.
2. `packages/engine` with full fixture tests (including IST period resolver — inject clock).
3. `packages/content` with 5 placeholder tracks to unblock UI.
4. `apps/web` layout: backgrounds, title lockup, player card shell, mobile layout.
5. YouTube adapter + wire to engine.
6. Asset pipeline script (sharp → AVIF/WebP/JPEG + OG image).
7. Curation research task → `tracks.candidates.ts` (60–80) → Anish prunes → `tracks.ts`.
8. `check-tracks` CI script.
9. Deploy (Cloudflare, static).

Estimated: steps 1–6 in one Claude Code session; step 7 is a separate research session; 8–9 trivial.