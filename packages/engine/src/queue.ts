/**
 * The playback queue. Immutable state + pure transitions, so the whole thing
 * runs offline against fixtures and the renderer is free to be as dumb as it
 * likes. No timers, no network, no DOM.
 */

import { shuffle } from "./shuffle";
import type { Track } from "./track";

export type Queue = {
  /** The authored track list, in authored order. Never mutated. */
  readonly tracks: readonly Track[];
  /** Play order as indices into `tracks`. */
  readonly order: readonly number[];
  /** Cursor into `order`. -1 only when `tracks` is empty. */
  readonly position: number;
  readonly seed: number;
  readonly shuffled: boolean;
  /** YouTube IDs the player has told us are dead (error 100/101/150). */
  readonly unavailable: readonly string[];
};

export type CreateQueueOptions = {
  /** Seed for the shuffle. Callers pass one so the order is reproducible. */
  seed?: number;
  /** Start shuffled. Default true — the site is a radio, not an album. */
  shuffle?: boolean;
  /** Open on a specific track (deep link `?t={youtubeId}`). */
  startId?: string;
};

const EMPTY: readonly string[] = [];

export function createQueue(tracks: readonly Track[], options: CreateQueueOptions = {}): Queue {
  const { seed = 1, shuffle: shuffled = true, startId } = options;
  const indices = tracks.map((_, index) => index);
  const order = shuffled ? shuffle(indices, seed) : indices;

  const queue: Queue = {
    tracks,
    order,
    position: tracks.length === 0 ? -1 : 0,
    seed,
    shuffled,
    unavailable: EMPTY,
  };

  return startId === undefined ? queue : jumpToId(queue, startId);
}

export function currentTrack(queue: Queue): Track | null {
  if (queue.position < 0) return null;
  const index = queue.order[queue.position];
  if (index === undefined) return null;
  return queue.tracks[index] ?? null;
}

export function isUnavailable(queue: Queue, youtubeId: string): boolean {
  return queue.unavailable.includes(youtubeId);
}

/** How many tracks are still playable. */
export function playableCount(queue: Queue): number {
  return queue.order.reduce((count, index) => {
    const track = queue.tracks[index];
    return track && !isUnavailable(queue, track.youtubeId) ? count + 1 : count;
  }, 0);
}

/**
 * Advances by `step` (+1 next, -1 prev), wrapping around the end of the queue
 * and stepping over anything marked unavailable. Returns the queue unchanged
 * when nothing playable remains, so a dead playlist can't spin forever.
 */
function step(queue: Queue, direction: 1 | -1): Queue {
  const length = queue.order.length;
  if (length === 0 || queue.position < 0) return queue;

  for (let hop = 1; hop <= length; hop++) {
    const position = (((queue.position + direction * hop) % length) + length) % length;
    const index = queue.order[position];
    const track = index === undefined ? undefined : queue.tracks[index];
    if (track && !isUnavailable(queue, track.youtubeId)) {
      return { ...queue, position };
    }
  }

  return queue;
}

export function next(queue: Queue): Queue {
  return step(queue, 1);
}

export function prev(queue: Queue): Queue {
  return step(queue, -1);
}

/** Track ended on its own — same transition as pressing next. */
export function onEnded(queue: Queue): Queue {
  return next(queue);
}

/**
 * The player reported the video is gone (100 / 101 / 150). Mark it, then move
 * on. If it was not the current track we only record it, leaving the cursor be.
 */
export function markUnavailable(queue: Queue, youtubeId: string): Queue {
  const marked: Queue = isUnavailable(queue, youtubeId)
    ? queue
    : { ...queue, unavailable: [...queue.unavailable, youtubeId] };

  const playing = currentTrack(marked);
  return playing?.youtubeId === youtubeId ? next(marked) : marked;
}

/** Move the cursor onto a specific track. No-op if the ID isn't in the queue. */
export function jumpToId(queue: Queue, youtubeId: string): Queue {
  const position = queue.order.findIndex((index) => queue.tracks[index]?.youtubeId === youtubeId);
  return position === -1 ? queue : { ...queue, position };
}

/**
 * Toggle shuffle without interrupting playback: the currently playing track
 * stays current, everything else is reordered around it.
 */
export function setShuffle(queue: Queue, shuffled: boolean, seed = queue.seed): Queue {
  const playing = currentTrack(queue);
  const indices = queue.tracks.map((_, index) => index);
  const order = shuffled ? shuffle(indices, seed) : indices;
  const rebuilt: Queue = { ...queue, order, shuffled, seed, position: order.length ? 0 : -1 };
  return playing ? jumpToId(rebuilt, playing.youtubeId) : rebuilt;
}

/** The next track that would play, for prefetching cover art. */
export function peekNext(queue: Queue): Track | null {
  return currentTrack(next(queue));
}
