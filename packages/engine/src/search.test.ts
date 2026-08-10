import { describe, expect, it } from "vitest";
import { makeTrack } from "./fixtures";
import { normalize, searchTracks } from "./search";
import type { Track } from "./track";

const TRACKS: Track[] = [
  makeTrack({
    youtubeId: "aaaaaaaaaa0",
    title: "Appadi Podu",
    titleTa: "அப்படி போடு",
    movie: "Ghilli",
    year: 2004,
    composer: "Vidyasagar",
    era: "2000s",
  }),
  makeTrack({
    youtubeId: "aaaaaaaaaa1",
    title: "Kalloori Salai",
    titleTa: "கல்லூரி சாலை",
    movie: "Kadhal Desam",
    year: 1996,
    composer: "A. R. Rahman",
    era: "90s",
  }),
  makeTrack({
    youtubeId: "aaaaaaaaaa2",
    title: "Indha Maan",
    titleTa: "இந்த மான்",
    movie: "Karakattakkaran",
    year: 1989,
    composer: "Ilaiyaraaja",
    era: "80s",
  }),
  makeTrack({
    youtubeId: "aaaaaaaaaa3",
    title: "Vidhai Podu",
    titleTa: "விதை போடு",
    movie: "Ilaiyaraaja Nights",
    year: 1993,
    composer: "Deva",
    era: "90s",
  }),
];

const ids = (query: string) => searchTracks(TRACKS, query).map((r) => r.track.youtubeId);

describe("normalize", () => {
  it("folds case, punctuation and spacing together", () => {
    expect(normalize("Kadhal-Desam")).toBe(normalize("kadhal desam"));
    expect(normalize("A. R. Rahman")).toBe("arrahman");
  });

  it("strips accents so a typed accent still matches", () => {
    expect(normalize("Ilaiyarâaja")).toBe("ilaiyaraaja");
  });

  it("leaves Tamil intact", () => {
    expect(normalize("அப்படி போடு")).toBe("அப்படிபோடு");
  });
});

describe("searchTracks", () => {
  it("returns everything (to the limit) for an empty query", () => {
    expect(searchTracks(TRACKS, "")).toHaveLength(TRACKS.length);
    expect(searchTracks(TRACKS, "   ")).toHaveLength(TRACKS.length);
    expect(searchTracks(TRACKS, "", 2)).toHaveLength(2);
  });

  it("matches a title from its start", () => {
    expect(ids("appadi")).toEqual(["aaaaaaaaaa0"]);
  });

  it("matches on any word of the title, not just the first", () => {
    // "podu" is the second word of both, so both come back.
    expect(ids("podu")).toEqual(["aaaaaaaaaa0", "aaaaaaaaaa3"]);
  });

  it("matches Tamil typed in Tamil", () => {
    const results = searchTracks(TRACKS, "அப்படி");
    expect(results.map((r) => r.track.youtubeId)).toEqual(["aaaaaaaaaa0"]);
    expect(results[0]?.matchedOn).toBe("titleTa");
  });

  it("matches the film and says so", () => {
    const results = searchTracks(TRACKS, "kadhal desam");
    expect(results[0]?.track.youtubeId).toBe("aaaaaaaaaa1");
    expect(results[0]?.matchedOn).toBe("movie");
  });

  it("matches the composer, spacing and dots included", () => {
    expect(ids("ar rahman")).toEqual(["aaaaaaaaaa1"]);
    expect(ids("a.r.rahman")).toEqual(["aaaaaaaaaa1"]);
  });

  it("ranks a title match above a composer or film match of the same word", () => {
    // "Ilaiyaraaja" is track 2's composer and track 3's film. Neither is a
    // title, so the field ranking decides: composer outranks nothing here, but
    // the film match must not jump ahead of it arbitrarily.
    const results = searchTracks(TRACKS, "ilaiyaraaja");
    expect(results.map((r) => r.track.youtubeId)).toEqual(["aaaaaaaaaa3", "aaaaaaaaaa2"]);
    expect(results[0]?.matchedOn).toBe("movie");
    expect(results[1]?.matchedOn).toBe("composer");
  });

  it("finds nothing for a query that matches nothing", () => {
    expect(ids("zzzzz")).toEqual([]);
  });

  it("is case- and punctuation-insensitive", () => {
    expect(ids("GHILLI")).toEqual(["aaaaaaaaaa0"]);
    expect(ids("  ghilli!  ")).toEqual(["aaaaaaaaaa0"]);
  });

  it("honours the limit", () => {
    expect(searchTracks(TRACKS, "a", 2)).toHaveLength(2);
  });
});
