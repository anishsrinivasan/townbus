import { describe, expect, it } from "vitest";
import { describeError, isPermanentError, YT_ERROR } from "./errors";

describe("isPermanentError", () => {
  it("retires the track for 100 / 101 / 150", () => {
    expect(isPermanentError(YT_ERROR.NOT_FOUND)).toBe(true);
    expect(isPermanentError(YT_ERROR.EMBED_DISALLOWED)).toBe(true);
    expect(isPermanentError(YT_ERROR.EMBED_DISALLOWED_ALT)).toBe(true);
  });

  it("treats 2, 5 and unknown codes as recoverable", () => {
    expect(isPermanentError(YT_ERROR.INVALID_PARAM)).toBe(false);
    expect(isPermanentError(YT_ERROR.HTML5)).toBe(false);
    expect(isPermanentError(999)).toBe(false);
  });
});

describe("describeError", () => {
  it("explains the codes a curator needs to act on", () => {
    expect(describeError(100)).toContain("removed");
    expect(describeError(101)).toContain("embedding");
    expect(describeError(150)).toBe(describeError(101));
  });

  it("names the code it does not recognise", () => {
    expect(describeError(42)).toContain("42");
  });
});
