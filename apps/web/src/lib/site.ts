import type { MirrorPlaylists } from "@townbus/adapter-links";
import { tracks } from "@townbus/content";

/**
 * The era the site actually plays, read off the shipped tracks rather than
 * written down. The year cap in `@townbus/content` is a knob, and copy that
 * claims "1985–2010" while the playlist stops at 1997 is the kind of thing
 * nobody notices until a stranger does.
 */
const years = tracks.map((track) => track.year);
const ERA = `${Math.min(...years)}–${Math.max(...years)}`;

/**
 * Single source of truth for the things that have to agree between the page,
 * the metadata and the OG card.
 */
export const site = {
  /**
   * The canonical origin. Everything absolute resolves against it —
   * `metadataBase`, the canonical link, `og:url` and the sitemap — so it has to
   * be the address people actually land on or shares resolve to nothing.
   *
   * Currently the Vercel deployment. Change this one line when the real domain
   * lands (PRD §12: buspaattu.com / .fm vs alternates) and set a redirect from
   * here to there, so old shares keep working.
   */
  url: "https://townbus.vercel.app",
  name: "BusPaattu",
  titleTa: "டவுன் பஸ் ஹிட்ஸ்",
  titleLatin: "Town Bus Hits",
  tagline: `Tamil kuthu, gaana & melody · ${ERA}`,
  description:
    `The songs that played through blown speakers on Tamil Nadu town buses — ` +
    `kuthu, gaana and melody, ${ERA}. Press play.`,
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
