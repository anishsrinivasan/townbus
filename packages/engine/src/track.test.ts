import { describe, expect, it } from "vitest";
import { FIXTURE_TRACKS, makeTrack } from "./fixtures";
import { containsTamil, eraForYear, isValidYoutubeId, validateTracks } from "./track";

describe("isValidYoutubeId", () => {
  it("accepts 11-char IDs including - and _", () => {
    expect(isValidYoutubeId("dQw4w9WgXcQ")).toBe(true);
    expect(isValidYoutubeId("a-b_c1D2e3F")).toBe(true);
  });

  it("rejects wrong lengths, URLs and stray characters", () => {
    expect(isValidYoutubeId("short")).toBe(false);
    expect(isValidYoutubeId("dQw4w9WgXcQextra")).toBe(false);
    expect(isValidYoutubeId("https://yt/x")).toBe(false);
    expect(isValidYoutubeId("dQw4w9WgXc!")).toBe(false);
  });
});

describe("containsTamil", () => {
  it("detects Tamil script", () => {
    expect(containsTamil("டவுன் பஸ் ஹிட்ஸ்")).toBe(true);
  });

  it("rejects Latin-only and Devanagari strings", () => {
    expect(containsTamil("Town Bus Hits")).toBe(false);
    expect(containsTamil("नमस्ते")).toBe(false);
  });
});

describe("eraForYear", () => {
  it("buckets years into the three eras", () => {
    expect(eraForYear(1987)).toBe("80s");
    expect(eraForYear(1989)).toBe("80s");
    expect(eraForYear(1990)).toBe("90s");
    expect(eraForYear(1999)).toBe("90s");
    expect(eraForYear(2000)).toBe("2000s");
    expect(eraForYear(2008)).toBe("2000s");
  });
});

describe("validateTracks", () => {
  it("passes a clean list", () => {
    expect(validateTracks(FIXTURE_TRACKS)).toEqual([]);
  });

  it("flags a malformed YouTube ID", () => {
    const problems = validateTracks([makeTrack({ youtubeId: "nope" })]);
    expect(problems.map((p) => p.field)).toContain("youtubeId");
  });

  it("flags duplicates, naming the earlier index", () => {
    const problems = validateTracks([
      makeTrack({ youtubeId: "aaaaaaaaaa0" }),
      makeTrack({ youtubeId: "aaaaaaaaaa0" }),
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]?.index).toBe(1);
    expect(problems[0]?.message).toContain("index 0");
  });

  it("requires a Tamil title in Tamil script", () => {
    const problems = validateTracks([makeTrack({ youtubeId: "aaaaaaaaaa0", titleTa: "Kaadhal" })]);
    expect(problems.map((p) => p.field)).toContain("titleTa");
  });

  it("rejects years outside the 1980–2010 era scope", () => {
    const problems = validateTracks([
      makeTrack({ youtubeId: "aaaaaaaaaa0", year: 1975, era: "80s" }),
      makeTrack({ youtubeId: "aaaaaaaaaa1", year: 2019, era: "2000s" }),
    ]);
    expect(problems.filter((p) => p.field === "year")).toHaveLength(2);
  });

  it("accepts the early-80s Ilaiyaraaja the curated playlists are anchored by", () => {
    expect(
      validateTracks([makeTrack({ youtubeId: "aaaaaaaaaa0", year: 1983, era: "80s" })]),
    ).toEqual([]);
  });

  it("catches an era that contradicts the year", () => {
    const problems = validateTracks([
      makeTrack({ youtubeId: "aaaaaaaaaa0", year: 2004, era: "90s" }),
    ]);
    expect(problems.map((p) => p.field)).toContain("era");
  });

  it("flags blank required text fields", () => {
    const problems = validateTracks([
      makeTrack({ youtubeId: "aaaaaaaaaa0", title: "  ", movie: "", composer: "" }),
    ]);
    expect(problems.map((p) => p.field).sort()).toEqual(["composer", "movie", "title"]);
  });
});
