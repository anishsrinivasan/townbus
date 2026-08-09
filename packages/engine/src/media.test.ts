import { describe, expect, it } from "vitest";
import { coverSources, thumbnailUrl, watchUrl } from "./media";

describe("thumbnailUrl", () => {
  it("defaults to hqdefault, the quality every video has", () => {
    expect(thumbnailUrl("dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });

  it("honours an explicit quality", () => {
    expect(thumbnailUrl("dQw4w9WgXcQ", "maxresdefault")).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
    );
  });
});

describe("coverSources", () => {
  it("prefers maxres and falls back to hq, never the other way round", () => {
    const { primary, fallback } = coverSources("dQw4w9WgXcQ");
    expect(primary).toContain("maxresdefault");
    expect(fallback).toContain("hqdefault");
  });
});

describe("watchUrl", () => {
  it("builds the canonical watch link for the link-out mode", () => {
    expect(watchUrl("dQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });
});
