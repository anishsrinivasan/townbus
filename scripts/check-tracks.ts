#!/usr/bin/env bun

/**
 * `bun run check-tracks`
 *
 * Two passes over the authored track list:
 *   1. structural — shape, Tamil titles, era/year agreement, duplicates (offline)
 *   2. liveness   — every youtubeId still exists *and* still allows embedding
 *
 * Both halves of that second check matter. oEmbed alone is not enough: an
 * upload can answer oEmbed with a cheerful 200 and still have embedding turned
 * off, which surfaces as player error 101/150 and a track the listener never
 * hears. So the watch page is read too, for `playableInEmbed`.
 *
 * What this cannot catch: some rights-holders (VEVO especially) allow embedding
 * in general but refuse specific *referrers* — a plain-HTTP localhost origin
 * gets a 150 that the production domain does not. That class of failure is only
 * observable at runtime, which is what the engine's error-skip is for.
 *
 * Exits non-zero on any problem so CI fails loudly rather than shipping a
 * playlist that silently skips half its tracks.
 */

// Everything authored, not just the shipped slice — a track parked outside the
// current year cap still has to be valid and still has to resolve, or raising
// the cap later quietly ships dead links.
import { LATEST_SHIPPED_YEAR, allTracks as tracks } from "@townbus/content";
import { type Track, validateTracks } from "@townbus/engine";

const OEMBED = "https://www.youtube.com/oembed";
const CONCURRENCY = 6;
const TIMEOUT_MS = 10_000;
const RETRIES = 2;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

type Liveness =
  | { ok: true; track: Track; author: string }
  | { ok: false; track: Track; reason: string };

async function probe(track: Track): Promise<Liveness> {
  const url = `${OEMBED}?format=json&url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${track.youtubeId}`,
  )}`;

  let lastReason = "unknown error";

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });

      if (response.ok) {
        const body = (await response.json()) as { author_name?: string };
        const embeddable = await allowsEmbedding(track.youtubeId);
        if (embeddable === false) {
          return { ok: false, track, reason: "owner disabled embedding (would fail 101/150)" };
        }
        return { ok: true, track, author: body.author_name ?? "unknown" };
      }

      // 401/403/404 are verdicts, not transport failures — do not retry them.
      if (response.status === 404 || response.status === 401 || response.status === 403) {
        return { ok: false, track, reason: `video unavailable (HTTP ${response.status})` };
      }
      lastReason = `HTTP ${response.status}`;
    } catch (error) {
      lastReason = error instanceof Error ? error.message : String(error);
    }

    if (attempt < RETRIES) await Bun.sleep(400 * (attempt + 1));
  }

  return { ok: false, track, reason: lastReason };
}

/**
 * The watch page carries `"playableInEmbed": true|false` in its bootstrap JSON.
 * Returns null when the flag can't be read, so a YouTube layout change
 * degrades to "unknown" rather than failing the whole build.
 */
async function allowsEmbedding(youtubeId: string): Promise<boolean | null> {
  try {
    const response = await fetch(`https://www.youtube.com/watch?v=${youtubeId}`, {
      headers: { "user-agent": UA, "accept-language": "en-US,en" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const match = (await response.text()).match(/"playableInEmbed"\s*:\s*(true|false)/);
    return match ? match[1] === "true" : null;
  } catch {
    return null;
  }
}

/** Bounded fan-out — YouTube rate-limits oEmbed if you hit it all at once. */
async function probeAll(list: readonly Track[]): Promise<Liveness[]> {
  const results: Liveness[] = new Array(list.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < list.length) {
      const index = cursor++;
      const track = list[index];
      if (!track) continue;
      results[index] = await probe(track);
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker));
  return results;
}

async function main() {
  const offlineOnly = process.argv.includes("--offline");

  console.log(`\nchecking ${tracks.length} tracks\n`);

  const problems = validateTracks(tracks);
  if (problems.length > 0) {
    console.error(`✗ ${problems.length} structural problem(s):\n`);
    for (const problem of problems) {
      console.error(
        `  [${problem.index}] ${problem.youtubeId} · ${problem.field}: ${problem.message}`,
      );
    }
    process.exit(1);
  }
  console.log("✓ structure: shape, Tamil titles, era/year, duplicates");

  const shipped = tracks.filter((track) => track.year <= LATEST_SHIPPED_YEAR).length;
  if (shipped < 40) {
    console.error(
      `✗ only ${shipped} tracks ship at the ${LATEST_SHIPPED_YEAR} cap — v1 needs 40+ (PRD §9 P0)`,
    );
    process.exit(1);
  }
  console.log(
    `✓ count: ${shipped} shipped (${tracks.length} authored, cap ${LATEST_SHIPPED_YEAR})`,
  );

  if (offlineOnly) {
    console.log("\nskipping oEmbed pass (--offline)\n");
    return;
  }

  const results = await probeAll(tracks);
  const dead = results.filter((result): result is Extract<Liveness, { ok: false }> => !result.ok);

  if (dead.length > 0) {
    console.error(`\n✗ ${dead.length} track(s) did not resolve:\n`);
    for (const { track, reason } of dead) {
      console.error(`  ${track.youtubeId}  ${track.title} — ${track.movie} (${track.year})`);
      console.error(`    ${reason}`);
    }
    process.exit(1);
  }

  console.log(`✓ liveness: all ${tracks.length} video IDs resolve via oEmbed\n`);
}

await main();
