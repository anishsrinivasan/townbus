import { describe, expect, it } from "vitest";
import { formatTime, progressRatio } from "./format";

describe("formatTime", () => {
  it("formats m:ss with a zero-padded seconds field", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(9)).toBe("0:09");
    expect(formatTime(65)).toBe("1:05");
    expect(formatTime(279)).toBe("4:39");
  });

  it("grows to h:mm:ss past an hour", () => {
    expect(formatTime(3600)).toBe("1:00:00");
    expect(formatTime(3725)).toBe("1:02:05");
  });

  it("truncates fractional seconds rather than rounding up", () => {
    expect(formatTime(59.9)).toBe("0:59");
  });

  it("degrades to 0:00 for NaN, Infinity and negatives", () => {
    expect(formatTime(Number.NaN)).toBe("0:00");
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe("0:00");
    expect(formatTime(-5)).toBe("0:00");
  });
});

describe("progressRatio", () => {
  it("returns a 0–1 fraction", () => {
    expect(progressRatio(30, 120)).toBe(0.25);
  });

  it("is 0 before the duration is known", () => {
    expect(progressRatio(30, 0)).toBe(0);
    expect(progressRatio(30, Number.NaN)).toBe(0);
  });

  it("clamps overshoot at the end of a track", () => {
    expect(progressRatio(130, 120)).toBe(1);
    expect(progressRatio(-1, 120)).toBe(0);
  });
});
