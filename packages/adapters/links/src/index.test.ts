import type { Track } from "@townbus/engine";
import { describe, expect, it } from "vitest";
import {
  linkOuts,
  searchQuery,
  spotifyPlaylistUrl,
  spotifySearchUrl,
  trackLinks,
  youtubeMusicPlaylistUrl,
  youtubeMusicSearchUrl,
} from "./index";

const track: Track = {
  youtubeId: "i1BqRYMFS08",
  title: "Appadi Podu",
  titleTa: "அப்படி போடு",
  movie: "Ghilli",
  year: 2004,
  composer: "Vidyasagar",
  era: "2000s",
  vibe: "kuthu",
};

describe("playlist URLs", () => {
  it("builds Spotify and YT Music playlist links", () => {
    expect(spotifyPlaylistUrl("37i9dQZF1DXcBWIGoYBM5M")).toBe(
      "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
    );
    expect(youtubeMusicPlaylistUrl("PLabc123")).toBe(
      "https://music.youtube.com/playlist?list=PLabc123",
    );
  });
});

describe("search URLs", () => {
  it("percent-encodes the query", () => {
    expect(spotifySearchUrl("Appadi Podu Ghilli")).toBe(
      "https://open.spotify.com/search/Appadi%20Podu%20Ghilli",
    );
    expect(youtubeMusicSearchUrl("Oh Podu & Gemini")).toContain("Oh%20Podu%20%26%20Gemini");
  });

  it("survives Tamil script in the query", () => {
    const url = youtubeMusicSearchUrl("அப்படி போடு");
    expect(url.startsWith("https://music.youtube.com/search?q=%")).toBe(true);
    expect(decodeURIComponent(url.split("q=")[1] as string)).toBe("அப்படி போடு");
  });
});

describe("searchQuery", () => {
  it("pairs the song with its film, which is how these are findable", () => {
    expect(searchQuery(track)).toBe("Appadi Podu Ghilli");
  });
});

describe("linkOuts", () => {
  it("uses the curated mirrors when they exist", () => {
    const links = linkOuts({ spotifyPlaylistId: "abc", youtubeMusicPlaylistId: "PLxyz" });
    expect(links.map((l) => l.kind)).toEqual(["playlist", "playlist"]);
    expect(links[0]?.href).toContain("/playlist/abc");
  });

  it("falls back to search links so the slot is never broken", () => {
    const links = linkOuts({});
    expect(links.map((l) => l.kind)).toEqual(["search", "search"]);
    expect(links.every((l) => l.href.startsWith("https://"))).toBe(true);
  });

  it("mixes a real mirror with a fallback independently", () => {
    const links = linkOuts({ spotifyPlaylistId: "abc" });
    expect(links[0]?.kind).toBe("playlist");
    expect(links[1]?.kind).toBe("search");
  });
});

describe("trackLinks", () => {
  it("offers both services for the current track", () => {
    expect(trackLinks(track).map((l) => l.label)).toEqual(["Spotify", "YT Music"]);
  });
});
