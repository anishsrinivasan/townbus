import { describe, expect, it } from "vitest";
import { BACKDROP_VARIANTS, backdropFile, backdropSourceName, backdropUrl } from "./backdrop";

describe("backdropFile", () => {
  it("names files period-orientation-size.format", () => {
    expect(backdropFile("night", "portrait", "half", "avif")).toBe("bg-night-portrait-half.avif");
    expect(backdropFile("morning", "landscape", "full", "jpg")).toBe(
      "bg-morning-landscape-full.jpg",
    );
  });

  it("produces a unique name for every variant × size × format", () => {
    const names = new Set<string>();
    for (const { period, orientation } of BACKDROP_VARIANTS) {
      for (const size of ["full", "half"] as const) {
        for (const format of ["avif", "webp", "jpg"] as const) {
          names.add(backdropFile(period, orientation, size, format));
        }
      }
    }
    expect(names.size).toBe(BACKDROP_VARIANTS.length * 2 * 3);
  });
});

describe("backdropUrl", () => {
  it("serves from /assets by default", () => {
    expect(backdropUrl("night", "landscape", "full", "webp")).toBe(
      "/assets/bg-night-landscape-full.webp",
    );
  });

  it("accepts an alternate base for the build script", () => {
    expect(backdropUrl("morning", "portrait", "half", "avif", "/tmp/out")).toBe(
      "/tmp/out/bg-morning-portrait-half.avif",
    );
  });
});

describe("BACKDROP_VARIANTS", () => {
  it("covers the full period × orientation matrix exactly once", () => {
    expect(BACKDROP_VARIANTS).toHaveLength(4);
    const keys = BACKDROP_VARIANTS.map((v) => backdropSourceName(v.period, v.orientation));
    expect(new Set(keys).size).toBe(4);
  });
});
