import type { MirrorPlaylists } from "@townbus/adapter-links";

/**
 * Single source of truth for the things that have to agree between the page,
 * the metadata and the OG card.
 */
export const site = {
  /** Swap once the domain is settled (PRD §12, blocking on Anish). */
  url: "https://buspaattu.com",
  name: "BusPaattu",
  titleTa: "டவுன் பஸ் ஹிட்ஸ்",
  titleLatin: "Town Bus Hits",
  tagline: "Tamil kuthu, gaana & melody · 1985–2010",
  description:
    "The songs that played through blown speakers on Tamil Nadu town buses — kuthu, gaana and melody, 1985 to 2010. Press play.",
} as const;

/**
 * Mirror playlists (PRD §9 P1). The Spotify mirror is Karthick's "TOWN BUS
 * Tamil Songs" list, which is also the curation source for `tracks.ts` — the
 * site and the mirror stay the same playlist rather than drifting apart.
 * YT Music has no mirror yet, so that link falls back to a search.
 */
export const mirrors: MirrorPlaylists = {
  spotifyPlaylistId: "3o1gPbKZDviP6LDnH9UQ52",
};

/**
 * Whether the YouTube iframe is shown in the deck.
 *
 * PRD §5 calls a visible, unobscured player a hard requirement, because
 * YouTube's terms ask for exactly that and say no hidden or 1px iframes. Set
 * to `false` here as a deliberate product decision — the record is the whole
 * visual, the way the reference product does it — which means the embed is
 * running outside those terms and could be blocked at YouTube's discretion.
 *
 * Flip this back to `true` to restore compliance; the player keeps working
 * either way, it just becomes a visible window in the deck again. Nothing else
 * in the app reads YouTube directly, so this is the only switch.
 */
export const SHOW_PLAYER = false;
