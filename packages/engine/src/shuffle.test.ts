import { describe, expect, it } from "vitest";
import { createRandom, shuffle } from "./shuffle";

describe("createRandom", () => {
  it("is deterministic per seed", () => {
    const a = createRandom(2024);
    const b = createRandom(2024);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("stays inside [0, 1)", () => {
    const random = createRandom(1);
    for (let i = 0; i < 5000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe("shuffle", () => {
  const items = Array.from({ length: 40 }, (_, i) => i);

  it("does not mutate the input", () => {
    const original = items.slice();
    shuffle(items, 9);
    expect(items).toEqual(original);
  });

  it("is a permutation", () => {
    expect([...shuffle(items, 9)].sort((a, b) => a - b)).toEqual(items);
  });

  it("actually reorders a 40-item list", () => {
    expect(shuffle(items, 9)).not.toEqual(items);
  });

  it("handles empty and single-item lists", () => {
    expect(shuffle([], 1)).toEqual([]);
    expect(shuffle(["only"], 1)).toEqual(["only"]);
  });

  it("gives every item a chance at the first slot across seeds", () => {
    const firsts = new Set<number>();
    for (let seed = 0; seed < 400; seed++) firsts.add(shuffle(items, seed)[0] as number);
    expect(firsts.size).toBeGreaterThan(items.length / 2);
  });
});
