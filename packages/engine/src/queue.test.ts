import { describe, expect, it } from "vitest";
import { FIXTURE_TRACKS, makeTrack } from "./fixtures";
import {
  createQueue,
  currentTrack,
  jumpToId,
  markUnavailable,
  next,
  onEnded,
  peekNext,
  playableCount,
  prev,
  setShuffle,
} from "./queue";

const ids = (queue: ReturnType<typeof createQueue>) =>
  queue.order.map((index) => queue.tracks[index]?.youtubeId);

describe("createQueue", () => {
  it("keeps authored order when shuffle is off", () => {
    const queue = createQueue(FIXTURE_TRACKS, { shuffle: false });
    expect(ids(queue)).toEqual(FIXTURE_TRACKS.map((t) => t.youtubeId));
    expect(currentTrack(queue)?.youtubeId).toBe("aaaaaaaaaa0");
  });

  it("is deterministic for a given seed and different across seeds", () => {
    const a = createQueue(FIXTURE_TRACKS, { seed: 42 });
    const b = createQueue(FIXTURE_TRACKS, { seed: 42 });
    const c = createQueue(FIXTURE_TRACKS, { seed: 43 });
    expect(ids(a)).toEqual(ids(b));
    expect(ids(a)).not.toEqual(ids(c));
  });

  it("shuffles without losing or duplicating tracks", () => {
    const queue = createQueue(FIXTURE_TRACKS, { seed: 7 });
    expect([...ids(queue)].sort()).toEqual(FIXTURE_TRACKS.map((t) => t.youtubeId).sort());
  });

  it("opens on startId when given one (deep link)", () => {
    const queue = createQueue(FIXTURE_TRACKS, { seed: 3, startId: "aaaaaaaaaa4" });
    expect(currentTrack(queue)?.youtubeId).toBe("aaaaaaaaaa4");
  });

  it("survives an empty track list", () => {
    const queue = createQueue([]);
    expect(queue.position).toBe(-1);
    expect(currentTrack(queue)).toBeNull();
    expect(currentTrack(next(queue))).toBeNull();
    expect(currentTrack(prev(queue))).toBeNull();
  });
});

describe("next / prev", () => {
  const base = createQueue(FIXTURE_TRACKS, { shuffle: false });

  it("advances and returns a new queue, leaving the old one untouched", () => {
    const advanced = next(base);
    expect(currentTrack(advanced)?.youtubeId).toBe("aaaaaaaaaa1");
    expect(currentTrack(base)?.youtubeId).toBe("aaaaaaaaaa0");
  });

  it("wraps past the end", () => {
    let queue = base;
    for (let i = 0; i < FIXTURE_TRACKS.length; i++) queue = next(queue);
    expect(currentTrack(queue)?.youtubeId).toBe("aaaaaaaaaa0");
  });

  it("wraps backwards from the first track", () => {
    expect(currentTrack(prev(base))?.youtubeId).toBe("aaaaaaaaaa5");
  });

  it("onEnded advances exactly like next — playback continues unattended", () => {
    expect(currentTrack(onEnded(base))?.youtubeId).toBe(currentTrack(next(base))?.youtubeId);
  });

  it("peekNext reports the upcoming track without moving", () => {
    expect(peekNext(base)?.youtubeId).toBe("aaaaaaaaaa1");
    expect(currentTrack(base)?.youtubeId).toBe("aaaaaaaaaa0");
  });
});

describe("markUnavailable", () => {
  const base = createQueue(FIXTURE_TRACKS, { shuffle: false });

  it("skips to the next track when the current one is dead", () => {
    const queue = markUnavailable(base, "aaaaaaaaaa0");
    expect(currentTrack(queue)?.youtubeId).toBe("aaaaaaaaaa1");
    expect(queue.unavailable).toContain("aaaaaaaaaa0");
  });

  it("steps over a dead track met later, without stopping on it", () => {
    const queue = markUnavailable(base, "aaaaaaaaaa1");
    expect(currentTrack(queue)?.youtubeId).toBe("aaaaaaaaaa0");
    expect(currentTrack(next(queue))?.youtubeId).toBe("aaaaaaaaaa2");
  });

  it("steps over consecutive dead tracks in one hop", () => {
    let queue = markUnavailable(base, "aaaaaaaaaa1");
    queue = markUnavailable(queue, "aaaaaaaaaa2");
    queue = markUnavailable(queue, "aaaaaaaaaa3");
    expect(currentTrack(next(queue))?.youtubeId).toBe("aaaaaaaaaa4");
  });

  it("does not loop forever when every track is dead", () => {
    let queue = base;
    for (const track of FIXTURE_TRACKS) queue = markUnavailable(queue, track.youtubeId);
    expect(playableCount(queue)).toBe(0);
    expect(next(queue)).toBe(queue);
    expect(prev(queue)).toBe(queue);
  });

  it("is idempotent — the same ID is only recorded once", () => {
    const once = markUnavailable(base, "aaaaaaaaaa3");
    const twice = markUnavailable(once, "aaaaaaaaaa3");
    expect(twice.unavailable).toEqual(["aaaaaaaaaa3"]);
  });

  it("keeps the last playable track playing rather than stranding the queue", () => {
    let queue = base;
    for (const track of FIXTURE_TRACKS.slice(1)) queue = markUnavailable(queue, track.youtubeId);
    expect(playableCount(queue)).toBe(1);
    expect(currentTrack(next(queue))?.youtubeId).toBe("aaaaaaaaaa0");
  });
});

describe("jumpToId", () => {
  const base = createQueue(FIXTURE_TRACKS, { shuffle: false });

  it("moves the cursor onto the requested track", () => {
    expect(currentTrack(jumpToId(base, "aaaaaaaaaa3"))?.youtubeId).toBe("aaaaaaaaaa3");
  });

  it("is a no-op for an unknown ID", () => {
    expect(jumpToId(base, "zzzzzzzzzzz")).toBe(base);
  });
});

describe("setShuffle", () => {
  it("keeps the current track playing across the toggle", () => {
    const queue = jumpToId(createQueue(FIXTURE_TRACKS, { shuffle: false }), "aaaaaaaaaa4");
    const shuffled = setShuffle(queue, true, 99);
    expect(currentTrack(shuffled)?.youtubeId).toBe("aaaaaaaaaa4");
    expect(shuffled.shuffled).toBe(true);
  });

  it("restores authored order when turned off", () => {
    const queue = createQueue(FIXTURE_TRACKS, { seed: 5 });
    const linear = setShuffle(queue, false);
    expect(ids(linear)).toEqual(FIXTURE_TRACKS.map((t) => t.youtubeId));
  });

  it("carries unavailable marks across the toggle", () => {
    const queue = markUnavailable(createQueue(FIXTURE_TRACKS, { shuffle: false }), "aaaaaaaaaa2");
    expect(setShuffle(queue, true, 11).unavailable).toContain("aaaaaaaaaa2");
  });
});

describe("single-track queue", () => {
  const solo = createQueue([makeTrack({ youtubeId: "solooooooo1" })], { shuffle: false });

  it("stays on the only track in both directions", () => {
    expect(currentTrack(next(solo))?.youtubeId).toBe("solooooooo1");
    expect(currentTrack(prev(solo))?.youtubeId).toBe("solooooooo1");
  });
});
