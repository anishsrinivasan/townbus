/**
 * Track search. Pure and offline, like everything else in here — the UI only
 * renders what this returns.
 *
 * People searching this playlist type it four different ways: the song in
 * Latin ("appadi podu"), the song in Tamil ("அப்படி"), the film ("ghilli"), or
 * the composer ("ilaiyaraaja"). All four are matched, and the field that
 * matched decides the rank — a song whose *title* starts with the query beats
 * one that merely shares a composer.
 */

import type { Track } from "./track";

export type SearchResult = {
  track: Track;
  /** Which field earned the match, so the UI can show why a row is here. */
  matchedOn: "title" | "titleTa" | "movie" | "composer";
};

/**
 * Folds a string down to something typo-tolerant: lower case, accents removed,
 * and punctuation and spacing dropped. That last part is what makes "kadhal
 * desam", "kadhaldesam" and "Kadhal-Desam" all find the same film.
 */
export function normalize(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      // Latin combining diacritics only — this range does not reach Tamil.
      .replace(/[̀-ͯ]/g, "")
      // `\p{M}` is not optional. Tamil vowel signs and the virama are combining
      // marks, not letters, so dropping marks turns அப்படி into அபபட — which
      // matches nothing and silently breaks every Tamil search.
      .replace(/[^\p{L}\p{N}\p{M}]+/gu, "")
      // Re-compose. Both sides of a comparison run through here so the form
      // does not affect matching, but returning composed text means the output
      // equals what you would type, which is what callers and tests expect.
      .normalize("NFC")
  );
}

/** Word-starts of a value, so "podu" matches "Appadi Podu" at full strength. */
function wordStarts(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}\p{M}]+/u)
    .filter(Boolean)
    .map((word) => normalize(word));
}

const FIELDS = [
  { key: "title", weight: 0 },
  { key: "titleTa", weight: 1 },
  { key: "movie", weight: 2 },
  { key: "composer", weight: 3 },
] as const;

/** Lower is better. Field rank dominates; position within the field breaks ties. */
function scoreField(value: string, query: string): number | null {
  const haystack = normalize(value);
  if (haystack.startsWith(query)) return 0;
  if (wordStarts(value).some((word) => word.startsWith(query))) return 1;
  return haystack.includes(query) ? 2 : null;
}

/**
 * Ranked matches for `query`, best first. An empty query returns the list
 * unchanged so the search panel can open showing everything.
 */
export function searchTracks(tracks: readonly Track[], query: string, limit = 40): SearchResult[] {
  const needle = normalize(query);
  if (needle === "") {
    return tracks.slice(0, limit).map((track) => ({ track, matchedOn: "title" as const }));
  }

  const scored: { result: SearchResult; score: number; index: number }[] = [];

  tracks.forEach((track, index) => {
    let best: { score: number; matchedOn: SearchResult["matchedOn"] } | null = null;

    for (const { key, weight } of FIELDS) {
      const kind = scoreField(track[key], needle);
      if (kind === null) continue;
      // Field rank outweighs match quality: a composer whose name merely
      // contains the query should never outrank a title that starts with it.
      const score = weight * 10 + kind;
      if (!best || score < best.score) best = { score, matchedOn: key };
    }

    if (best) {
      scored.push({ result: { track, matchedOn: best.matchedOn }, score: best.score, index });
    }
  });

  return scored
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.result);
}
