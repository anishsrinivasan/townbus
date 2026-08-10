"use client";

import { createPlayer, type PlaybackStatus, type Player } from "@townbus/adapter-youtube";
import { tracks } from "@townbus/content";
import {
  createQueue,
  currentTrack,
  jumpToId,
  markUnavailable,
  next,
  playableCount,
  prev,
  type Queue,
} from "@townbus/engine";
import { parseAsString, useQueryState } from "nuqs";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { SELECT_TRACK_EVENT } from "./search-dialog";

const TICK_MS = 250;

export type Radio = ReturnType<typeof useRadio>;

/**
 * Binds the pure queue in @townbus/engine to the YouTube adapter.
 *
 * All the playlist logic lives in the engine and all the YouTube logic lives in
 * the adapter; this hook only owns React state and the wiring between them.
 */
export function useRadio(deckRef: RefObject<HTMLDivElement | null>) {
  /**
   * First render matches the server-rendered card exactly — unshuffled, first
   * track — so hydration is clean. The shuffle happens on mount, below.
   */
  const [queue, setQueue] = useState<Queue>(() => createQueue(tracks, { shuffle: false }));
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  /** Set by the first play tap. Track changes only auto-play after that. */
  const [started, setStarted] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);

  const playerRef = useRef<Player | null>(null);
  const startedRef = useRef(false);
  const track = currentTrack(queue);

  /**
   * `?id={youtubeId}` — the shareable deep link (PRD §9 P1).
   *
   * Held in nuqs so the URL and the player stay one piece of state: arriving
   * with an id opens on that track, and changing track rewrites the id, so the
   * address bar is always something worth copying.
   *
   * `history: "replace"` on purpose — every track change pushing an entry would
   * turn the browser's back button into a rewind button, which is not what it
   * means anywhere else.
   */
  const [linkedId, setLinkedId] = useQueryState(
    "id",
    parseAsString.withOptions({ history: "replace", scroll: false }),
  );

  /**
   * Shuffle on mount, not on first render: the seed is clock-derived, so doing
   * it during render would make the client HTML disagree with the build output.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount only; the id is read once
  useEffect(() => {
    setQueue(
      createQueue(tracks, {
        seed: Date.now() >>> 0,
        shuffle: true,
        startId: linkedId ?? undefined,
      }),
    );
  }, []);

  /** Keep the address bar pointing at whatever is playing. */
  useEffect(() => {
    if (track && track.youtubeId !== linkedId) void setLinkedId(track.youtubeId);
  }, [track, linkedId, setLinkedId]);

  /** Callbacks the player closes over — kept in a ref so it is created once. */
  const handlers = useRef({
    onEnded: () => setQueue((current) => next(current)),
    onUnavailable: (youtubeId: string) =>
      setQueue((current) => markUnavailable(current, youtubeId)),
  });

  useEffect(() => {
    const container = deckRef.current;
    if (!container) return;

    let disposed = false;
    let player: Player | null = null;

    createPlayer({
      container,
      initialVideoId: currentTrack(createQueue(tracks, { shuffle: false }))?.youtubeId,
      onReady: () => {
        if (!disposed) setReady(true);
      },
      onStatusChange: (next) => {
        if (!disposed) setStatus(next);
      },
      onEnded: () => handlers.current.onEnded(),
      onUnavailable: (youtubeId) => handlers.current.onUnavailable(youtubeId),
    })
      .then((created) => {
        if (disposed) {
          created.destroy();
          return;
        }
        player = created;
        playerRef.current = created;
      })
      .catch((error) => {
        // Link-out mode is the fallback: the page keeps its Spotify/YT Music
        // buttons and the card just never becomes interactive.
        console.error("[townbus] player unavailable", error);
      });

    return () => {
      disposed = true;
      player?.destroy();
      playerRef.current = null;
    };
  }, [deckRef]);

  /** Load whatever the queue is pointing at; auto-play only once started. */
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the ID, not the object
  useEffect(() => {
    if (!ready || !track) return;
    const player = playerRef.current;
    if (!player || player.currentVideoId() === track.youtubeId) return;
    player.load(track.youtubeId, { autoplay: startedRef.current });
    setElapsed(0);
    setDuration(0);
  }, [ready, track?.youtubeId]);

  /** Seek-bar clock. Only runs while something is actually playing. */
  useEffect(() => {
    if (status !== "playing") return;
    const id = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      if (!scrubbing) setElapsed(player.elapsed());
      setDuration(player.duration());
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [status, scrubbing]);

  const play = useCallback(() => {
    startedRef.current = true;
    setStarted(true);
    playerRef.current?.play();
  }, []);

  const pause = useCallback(() => playerRef.current?.pause(), []);

  const toggle = useCallback(() => {
    if (status === "playing" || status === "buffering") pause();
    else play();
  }, [status, play, pause]);

  const skipNext = useCallback(() => setQueue((current) => next(current)), []);
  const skipPrev = useCallback(() => setQueue((current) => prev(current)), []);
  const selectTrack = useCallback(
    (youtubeId: string) => setQueue((current) => jumpToId(current, youtubeId)),
    [],
  );

  /**
   * Picking a song from search should start it, not just queue it silently.
   * The click is the user gesture the browser wants, so marking playback as
   * started here means the load effect autoplays it.
   */
  const playTrack = useCallback((youtubeId: string) => {
    startedRef.current = true;
    setStarted(true);
    setQueue((current) => jumpToId(current, youtubeId));
  }, []);

  /** Search lives in the header; the queue lives here. */
  useEffect(() => {
    const onSelect = (event: Event) => {
      const youtubeId = (event as CustomEvent<string>).detail;
      if (typeof youtubeId === "string") playTrack(youtubeId);
    };
    window.addEventListener(SELECT_TRACK_EVENT, onSelect);
    return () => window.removeEventListener(SELECT_TRACK_EVENT, onSelect);
  }, [playTrack]);

  const seek = useCallback((seconds: number) => {
    setElapsed(seconds);
    playerRef.current?.seekTo(seconds);
  }, []);

  /**
   * Keyboard transport, desktop only per PRD §8 — `pointer: fine` is the
   * proxy for "has a keyboard", and it keeps space bar off touch devices where
   * it means scroll.
   */
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Never steal keys from a control the user is actually operating.
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.code === "Space" || event.key === "k") {
        event.preventDefault();
        toggle();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        skipNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        skipPrev();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle, skipNext, skipPrev]);

  return {
    track,
    queue,
    status,
    ready,
    started,
    elapsed,
    duration,
    playable: playableCount(queue),
    isPlaying: status === "playing",
    isBusy: status === "buffering",
    play,
    pause,
    toggle,
    skipNext,
    skipPrev,
    selectTrack,
    playTrack,
    seek,
    setScrubbing,
  };
}
