/**
 * Test fixtures. Deliberately synthetic — the engine must be provable without
 * reaching for the real `@townbus/content` list, which changes every PR.
 */

import type { Track } from "./track";

export function makeTrack(overrides: Partial<Track> & { youtubeId: string }): Track {
  return {
    title: "Test Paattu",
    titleTa: "டெஸ்ட் பாட்டு",
    movie: "Test Padam",
    year: 1995,
    composer: "Deva",
    era: "90s",
    vibe: "kuthu",
    ...overrides,
  };
}

/** Six tracks with IDs `aaaaaaaaaa0`…`aaaaaaaaaa5` — 11 chars, so they validate. */
export const FIXTURE_TRACKS: readonly Track[] = Array.from({ length: 6 }, (_, i) =>
  makeTrack({ youtubeId: `aaaaaaaaaa${i}`, title: `Track ${i}` }),
);
