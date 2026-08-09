import type { Era, Track, Vibe } from "@townbus/engine";
import { tracks as authored } from "./tracks";

/**
 * The newest year that makes the cut.
 *
 * The curation runs to 2010, but the town-bus sound people actually remember
 * thins out after the mid-2000s, so the shipped playlist stops at 2004. Raise
 * this to open the later years up — nothing else has to change, and the tracks
 * stay in the file either way.
 */
export const LATEST_SHIPPED_YEAR = 2004;

/** Everything authored in `tracks.ts`, including years the site does not ship. */
export const allTracks: readonly Track[] = authored;

/** What the site actually plays. */
export const tracks: readonly Track[] = authored.filter(
  (track) => track.year <= LATEST_SHIPPED_YEAR,
);

/** Every composer on the list, most-represented first — the spine, in numbers. */
export function composers(list: readonly Track[] = tracks): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const track of list) counts.set(track.composer, (counts.get(track.composer) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function byEra(era: Era, list: readonly Track[] = tracks): Track[] {
  return list.filter((track) => track.era === era);
}

export function byVibe(vibe: Vibe, list: readonly Track[] = tracks): Track[] {
  return list.filter((track) => track.vibe === vibe);
}

export function findById(youtubeId: string, list: readonly Track[] = tracks): Track | undefined {
  return list.find((track) => track.youtubeId === youtubeId);
}
