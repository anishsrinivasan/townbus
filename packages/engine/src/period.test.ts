import { describe, expect, it, vi } from "vitest";
import { istHour, periodScript, resolvePeriod } from "./period";

/** Builds an instant from an IST wall-clock time (UTC+05:30, no DST). */
const ist = (hour: number, minute = 0) =>
  new Date(Date.UTC(2026, 0, 15, hour, minute) - (5 * 60 + 30) * 60_000);

describe("istHour", () => {
  it("reads the IST wall clock regardless of the host timezone", () => {
    expect(istHour(ist(0))).toBe(0);
    expect(istHour(ist(13, 45))).toBe(13);
    expect(istHour(ist(23, 59))).toBe(23);
  });

  it("handles the half-hour offset without drifting an hour", () => {
    // 18:20 UTC is 23:50 IST — same day; 18:40 UTC is 00:10 IST the next day.
    expect(istHour(new Date("2026-01-15T18:20:00Z"))).toBe(23);
    expect(istHour(new Date("2026-01-15T18:40:00Z"))).toBe(0);
  });
});

describe("resolvePeriod", () => {
  it("is night before 05:00 IST", () => {
    expect(resolvePeriod(ist(0))).toBe("night");
    expect(resolvePeriod(ist(4, 59))).toBe("night");
  });

  it("flips to morning at exactly 05:00 IST", () => {
    expect(resolvePeriod(ist(5, 0))).toBe("morning");
  });

  it("stays morning through the afternoon", () => {
    expect(resolvePeriod(ist(12))).toBe("morning");
    expect(resolvePeriod(ist(17, 59))).toBe("morning");
  });

  it("flips to night at exactly 18:00 IST", () => {
    expect(resolvePeriod(ist(18, 0))).toBe("night");
  });

  it("shows the night backdrop for the 20:00 IST acceptance case", () => {
    expect(resolvePeriod(ist(20))).toBe("night");
    expect(resolvePeriod(ist(23, 59))).toBe("night");
  });

  it("does not depend on the viewer's local timezone", () => {
    // The same instant, whatever the host TZ is set to: 20:00 IST.
    expect(resolvePeriod(new Date("2026-01-15T14:30:00Z"))).toBe("night");
  });
});

describe("periodScript", () => {
  /** Minimal localStorage stand-in holding a single pinned mode. */
  const storage = (stored: string | null) => ({ getItem: () => stored });

  /** Runs the inline snippet against a fake document and reports what it set. */
  const run = (now: Date): "morning" | "night" => {
    const documentElement = { dataset: {} as { period?: string } };
    vi.setSystemTime(now);
    try {
      new Function("document", "localStorage", periodScript())({ documentElement }, storage(null));
    } finally {
      vi.useRealTimers();
    }
    // Night is also the CSS default, so an unset attribute reads as night —
    // which is what a visitor with JavaScript off gets.
    return documentElement.dataset.period === "morning" ? "morning" : "night";
  };

  it("agrees with resolvePeriod across the whole day", () => {
    for (let hour = 0; hour < 24; hour++) {
      for (const minute of [0, 30, 59]) {
        const now = ist(hour, minute);
        expect({ hour, minute, period: run(now) }).toEqual({
          hour,
          minute,
          period: resolvePeriod(now),
        });
      }
    }
  });

  it("agrees on both boundaries", () => {
    expect(run(ist(4, 59))).toBe("night");
    expect(run(ist(5, 0))).toBe("morning");
    expect(run(ist(17, 59))).toBe("morning");
    expect(run(ist(18, 0))).toBe("night");
  });

  /** Runs the snippet with a mode pinned in storage, ignoring the clock. */
  const runPinned = (stored: string, now: Date): string | undefined => {
    const documentElement = { dataset: {} as { period?: string } };
    vi.setSystemTime(now);
    try {
      new Function("document", "localStorage", periodScript())(
        { documentElement },
        storage(stored),
      );
    } finally {
      vi.useRealTimers();
    }
    return documentElement.dataset.period;
  };

  it("honours a pinned mode over the clock, in both directions", () => {
    // 22:00 IST would resolve to night; pinned morning must win, and vice versa.
    expect(runPinned("morning", ist(22))).toBe("morning");
    expect(runPinned("night", ist(12))).toBe("night");
  });

  it("falls back to the clock for `system` or a junk value", () => {
    expect(runPinned("system", ist(12))).toBe("morning");
    expect(runPinned("system", ist(22))).toBe("night");
    expect(runPinned("nonsense", ist(12))).toBe("morning");
  });

  it("swallows anything the host environment throws at it", () => {
    const hostile = {
      get documentElement(): never {
        throw new Error("no document");
      },
    };
    // A browser with storage blocked must still get a backdrop, not a crash.
    const noStorage = {
      getItem: () => {
        throw new Error("storage disabled");
      },
    };
    expect(() =>
      new Function("document", "localStorage", periodScript())(hostile, storage(null)),
    ).not.toThrow();
    expect(() =>
      new Function("document", "localStorage", periodScript())(
        { documentElement: { dataset: {} } },
        noStorage,
      ),
    ).not.toThrow();
  });
});
