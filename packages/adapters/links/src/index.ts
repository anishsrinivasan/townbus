/**
 * Link-out builders for the mirror playlists.
 *
 * v1 hosts no audio and streams nothing but the visible YouTube player, so the
 * Spotify / YT Music buttons are exactly that — links. This module is also the
 * whole of the fallback plan: if embedded playback ever has to go, the page
 * degrades to these links and nothing else changes.
 */

import type { Track } from "@townbus/engine";

export type MirrorPlaylists = {
  /** Spotify playlist ID (22-char base62), created by hand. */
  spotifyPlaylistId?: string;
  /** YouTube Music playlist ID, usually `PL…` or `VL…`. */
  youtubeMusicPlaylistId?: string;
};

export type LinkOut = {
  label: string;
  href: string;
  /** Distinguishes a real curated mirror from the generated fallback. */
  kind: "playlist" | "search";
};

export function spotifyPlaylistUrl(playlistId: string): string {
  return `https://open.spotify.com/playlist/${playlistId}`;
}

export function youtubeMusicPlaylistUrl(playlistId: string): string {
  return `https://music.youtube.com/playlist?list=${playlistId}`;
}

export function spotifySearchUrl(query: string): string {
  return `https://open.spotify.com/search/${encodeURIComponent(query)}`;
}

export function youtubeMusicSearchUrl(query: string): string {
  return `https://music.youtube.com/search?q=${encodeURIComponent(query)}`;
}

/** `Song Title Movie` — the phrasing that actually finds Tamil film songs. */
export function searchQuery(track: Track): string {
  return `${track.title} ${track.movie}`;
}

/**
 * The two buttons in the corner of the page. Falls back to a search link for a
 * service with no mirror playlist yet, so the slot is never empty or broken.
 */
export function linkOuts(
  mirrors: MirrorPlaylists,
  fallbackQuery = "Tamil town bus songs",
): LinkOut[] {
  return [
    mirrors.spotifyPlaylistId
      ? {
          label: "Spotify",
          href: spotifyPlaylistUrl(mirrors.spotifyPlaylistId),
          kind: "playlist" as const,
        }
      : { label: "Spotify", href: spotifySearchUrl(fallbackQuery), kind: "search" as const },
    mirrors.youtubeMusicPlaylistId
      ? {
          label: "YT Music",
          href: youtubeMusicPlaylistUrl(mirrors.youtubeMusicPlaylistId),
          kind: "playlist" as const,
        }
      : { label: "YT Music", href: youtubeMusicSearchUrl(fallbackQuery), kind: "search" as const },
  ];
}

/** Per-track links, for the "find this song elsewhere" affordance. */
export function trackLinks(track: Track): LinkOut[] {
  const query = searchQuery(track);
  return [
    { label: "Spotify", href: spotifySearchUrl(query), kind: "search" },
    { label: "YT Music", href: youtubeMusicSearchUrl(query), kind: "search" },
  ];
}
