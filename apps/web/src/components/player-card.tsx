"use client";

import { COVER_SIZE, coverUrl, formatTime, progressRatio, type Track } from "@townbus/engine";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { type RefObject, useId, useState } from "react";
import { SHOW_PLAYER } from "@/lib/site";
import type { Radio } from "./use-radio";

type Props = { radio: Radio; deckRef: RefObject<HTMLDivElement | null> };

/**
 * The deck. A single floating capsule rather than a docked bar — the painted
 * artwork is the page, and the player is a thing sitting on top of it.
 *
 * The record on the left is the artwork; the YouTube player is a separate
 * element whose visibility is governed by `SHOW_PLAYER` (see `Deck` below).
 */
export default function PlayerCard({ radio, deckRef }: Props) {
  const { track } = radio;
  const seekId = useId();

  return (
    <section
      className="card relative mx-auto backdrop-blur-xl backdrop-saturate-150 flex w-full max-w-[40rem] items-center gap-3.5 rounded-[1.5rem] px-3 py-3 sm:gap-4 sm:rounded-[2rem] sm:px-4 sm:py-3.5"
      aria-label="Now playing"
    >
      <Record track={track} spinning={radio.isPlaying} />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Meta track={track} />
        <Seek radio={radio} id={seekId} />
      </div>

      <Transport radio={radio} />
      <Deck deckRef={deckRef} />
    </section>
  );
}

/**
 * The cover, as a record on a deck — turning while the track plays and stopping
 * when it stops.
 *
 * Art is served from our own origin: `bun run covers` bakes a true square crop
 * per track at build time, which is both a better shape for a disc than a 4:3
 * thumbnail and about a fifth the bytes of hotlinking `i.ytimg.com` (PRD §5).
 */
function Record({ track, spinning }: { track: Track | null; spinning: boolean }) {
  // Reset the failure flag whenever the track changes, or one missing cover
  // would leave every later track showing the placeholder.
  const [failed, setFailed] = useState<string | null>(null);
  const broken = !track || failed === track.youtubeId;

  if (!track) return <div className="record size-[3.75rem] sm:size-[4.75rem]" data-blank="true" />;

  return (
    <div
      className="record size-[3.75rem] sm:size-[4.75rem]"
      data-spinning={spinning}
      data-blank={broken || undefined}
    >
      {/* biome-ignore lint/performance/noImgElement: static export has no image optimiser */}
      <img
        // Keyed so a new track always gets a fresh element, and a previously
        // failed one retries rather than inheriting the broken state.
        key={track.youtubeId}
        src={coverUrl(track.youtubeId)}
        alt={`${track.title} — ${track.movie} (${track.year})`}
        width={COVER_SIZE}
        height={COVER_SIZE}
        loading="eager"
        decoding="async"
        onError={() => setFailed(track.youtubeId)}
        style={broken ? { visibility: "hidden" } : undefined}
      />
    </div>
  );
}

/**
 * The YouTube player itself. See `SHOW_PLAYER` in lib/site.ts for why it is
 * currently off-screen rather than on show, and what that trades away.
 *
 * Off-screen, not `display: none` and not 1×1: the player still needs real
 * dimensions and a live layout box, or browsers throttle or refuse to decode
 * it and playback stalls on exactly the devices that matter.
 *
 * `YT.Player` replaces the element it is handed, so the adapter appends its own
 * mount node inside this div rather than consuming the div React rendered.
 */
function Deck({ deckRef }: { deckRef: RefObject<HTMLDivElement | null> }) {
  if (!SHOW_PLAYER) {
    return (
      // Positioned inline, not by class: the `.deck` rule sets `position:
      // relative` and lands after Tailwind's utilities in the stylesheet, so a
      // `absolute` class here loses on source order and the player stays in
      // flow — a 320×180 hole punched through the middle of the pill.
      <div
        className="deck"
        style={{
          position: "absolute",
          left: "-10000px",
          top: 0,
          width: 320,
          height: 180,
          opacity: 0,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        <div ref={deckRef} />
      </div>
    );
  }

  return (
    <div
      className="deck aspect-video w-[4rem] shrink-0 rounded-lg sm:w-[5.5rem]"
      title="Playing from YouTube"
    >
      <div ref={deckRef} />
    </div>
  );
}

function Meta({ track }: { track: Track | null }) {
  if (!track) {
    return <p className="text-[color:var(--tb-muted)] text-sm">No tracks in the playlist yet.</p>;
  }

  return (
    <div className="min-w-0">
      {/*
        Tamil first, Latin under it — that order is half the point. Set in
        Catamaran, not the Baloo display face: that one is the logo's, and a
        song title wearing it reads as a second logo.
      */}
      <h2
        className="truncate font-semibold text-[clamp(0.98rem,3.6vw,1.22rem)] text-[color:var(--tb-cream)] leading-snug"
        title={track.titleTa}
        lang="ta"
      >
        {track.titleTa}
      </h2>
      <p className="truncate text-[0.72rem] text-[color:var(--tb-muted)] sm:text-[0.78rem]">
        {track.title}
        <span className="text-[color:var(--tb-muted)]/70">
          {" · "}
          {track.movie} · {track.year}
        </span>
        {/* Composer is the spine of the curation, so it earns a line of its own
            on wide screens rather than being the first thing truncated. */}
        <span className="hidden text-[color:var(--tb-muted)]/70 lg:inline">
          {" · "}
          {track.composer}
        </span>
      </p>
    </div>
  );
}

/** 44px minimum on every target — these get pressed on a moving bus. */
const BUTTON =
  "grid size-11 place-items-center rounded-full text-[color:var(--tb-cream)]/80 transition-colors hover:text-[color:var(--tb-cream)] disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-[color:var(--tb-amber)] focus-visible:outline-offset-2";

function Transport({ radio }: { radio: Radio }) {
  const disabled = !radio.ready || radio.playable === 0;

  return (
    <div className="flex shrink-0 items-center">
      <button
        type="button"
        onClick={radio.skipPrev}
        disabled={disabled}
        className={`${BUTTON} hidden sm:grid`}
        aria-label="Previous track"
      >
        <SkipBack className="size-[1.15rem]" fill="currentColor" strokeWidth={0} />
      </button>

      <button
        type="button"
        onClick={radio.toggle}
        disabled={disabled}
        className="grid size-12 place-items-center rounded-full bg-[color:var(--tb-cream)] text-[color:var(--tb-night-deep)] shadow-[0_6px_18px_-6px_oklch(0.06_0.01_50/0.9)] transition-transform hover:scale-[1.04] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 focus-visible:outline-2 focus-visible:outline-[color:var(--tb-amber)] focus-visible:outline-offset-3"
        aria-label={radio.isPlaying ? "Pause" : "Play"}
        aria-pressed={radio.isPlaying}
      >
        {radio.isPlaying ? (
          <Pause className="size-[1.15rem]" fill="currentColor" strokeWidth={0} />
        ) : (
          <Play className="size-[1.15rem] translate-x-[1px]" fill="currentColor" strokeWidth={0} />
        )}
      </button>

      <button
        type="button"
        onClick={radio.skipNext}
        disabled={disabled}
        className={BUTTON}
        aria-label="Next track"
      >
        <SkipForward className="size-[1.15rem]" fill="currentColor" strokeWidth={0} />
      </button>
    </div>
  );
}

function Seek({ radio, id }: { radio: Radio; id: string }) {
  const { elapsed, duration } = radio;
  const percent = progressRatio(elapsed, duration) * 100;

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <input
        id={id}
        type="range"
        min={0}
        max={Math.max(duration, 1)}
        step={1}
        value={Math.min(elapsed, duration || 1)}
        disabled={!radio.ready || duration === 0}
        onPointerDown={() => radio.setScrubbing(true)}
        onPointerUp={() => radio.setScrubbing(false)}
        onKeyDown={() => radio.setScrubbing(true)}
        onKeyUp={() => radio.setScrubbing(false)}
        onChange={(event) => radio.seek(Number(event.target.value))}
        className="seek"
        style={{ ["--seek-progress" as string]: `${percent}%` }}
        aria-label="Seek"
      />
      <span className="font-mono text-[0.66rem] text-[color:var(--tb-muted)] tabular-nums">
        {formatTime(elapsed)} / {formatTime(duration)}
      </span>
    </div>
  );
}
