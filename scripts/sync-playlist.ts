#!/usr/bin/env bun
/**
 * `bun run sync-playlist -- --spotify <playlistId>`
 * `bun run sync-playlist -- --youtube <playlistId>`
 *
 * Turns a real playlist into `tracks.candidates.ts`, so curation happens in
 * Spotify or YouTube Music — where it is actually pleasant — instead of in a
 * TypeScript literal.
 *
 * Why this is a build step and not a fetch in the page: the Spotify Web API
 * needs a client secret and the YouTube Data API needs a key, and a static site
 * on Cloudflare can hold neither without a backend that PRD §3 rules out. So
 * the network calls happen here, on a laptop, and what ships is still a plain
 * TypeScript file in git (PRD §5).
 *
 * The output is *candidates*, never `tracks.ts`. Every entry carries the film,
 * year, composer and Tamil title as best-guesses marked TODO where they could
 * not be derived — a human prunes and fills them, which is the whole product.
 *
 * Resumable: results are cached under `.cache/`, so a run interrupted by
 * YouTube's rate limiter picks up where it stopped.
 */

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { containsTamil, isValidYoutubeId } from "@townbus/engine";

const ROOT = new URL("..", import.meta.url).pathname;
const CACHE_DIR = join(ROOT, ".cache");
const CACHE_FILE = join(CACHE_DIR, "sync-playlist.json");
const OUT_FILE = join(ROOT, "packages/content/src/tracks.candidates.ts");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

/** YouTube blocks bursts. One search every ~7s is the pace that survives. */
const SEARCH_DELAY_MS = 6_000;
const SEARCH_JITTER_MS = 5_000;
const BLOCK_COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 480_000;

type Source = { title: string; artists: string; film: string };
type Candidate = Source & { youtubeId: string; youtubeTitle: string; channel: string };
type Cache = Record<string, { id: string; title: string; channel: string } | null>;

// ---------------------------------------------------------------- playlists

/**
 * Spotify's oEmbed-adjacent embed page ships the whole track list as JSON and
 * needs no credentials. It is an internal endpoint, so it is read here rather
 * than from the browser — and if its shape ever changes, this throws loudly
 * instead of silently emitting an empty playlist.
 */
async function readSpotifyPlaylist(playlistId: string): Promise<Source[]> {
  const response = await fetch(`https://open.spotify.com/embed/playlist/${playlistId}`, {
    headers: { "user-agent": UA },
  });
  if (!response.ok) throw new Error(`Spotify playlist ${playlistId}: HTTP ${response.status}`);

  const html = await response.text();
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match?.[1]) throw new Error("Spotify embed payload not found — the page shape changed");

  const entity = JSON.parse(match[1])?.props?.pageProps?.state?.data?.entity;
  const trackList = entity?.trackList as { title: string; subtitle: string }[] | undefined;
  if (!trackList?.length) throw new Error("Spotify embed contained no tracks");

  console.log(`playlist: ${entity.name} — ${trackList.length} tracks\n`);

  return trackList.map((track) => ({
    // `Muthumani Maalai (From "Chinna Gounder")` carries the film in the title.
    film: track.title.match(/\(From "([^"]+)"\)/)?.[1] ?? "",
    title: cleanTitle(track.title),
    artists: track.subtitle,
  }));
}

/** A public YouTube playlist page already lists its videos — no key needed. */
async function readYoutubePlaylist(playlistId: string): Promise<Candidate[]> {
  const response = await fetch(`https://www.youtube.com/playlist?list=${playlistId}`, {
    headers: { "user-agent": UA, "accept-language": "en-US,en" },
  });
  if (!response.ok) throw new Error(`YouTube playlist ${playlistId}: HTTP ${response.status}`);

  const data = parseYtInitialData(await response.text());
  if (!data) throw new Error("YouTube playlist payload not found — the page shape changed");

  const found: Candidate[] = [];
  walk(data, (node) => {
    const video = asObject(node.playlistVideoRenderer);
    const videoId = video?.videoId;
    if (typeof videoId !== "string" || !isValidYoutubeId(videoId)) return;
    const title = runText(video?.title);
    found.push({
      youtubeId: videoId,
      youtubeTitle: title,
      channel: runText(video?.shortBylineText),
      title: cleanTitle(title),
      artists: "",
      film: "",
    });
  });

  console.log(`playlist ${playlistId} — ${found.length} videos\n`);
  return found;
}

// ------------------------------------------------------------ youtube search

async function searchYoutube(
  query: string,
): Promise<{ id: string; title: string; channel: string } | null | "blocked"> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`;

  let html: string;
  try {
    const response = await fetch(url, {
      headers: { "user-agent": UA, "accept-language": "en-US,en" },
      redirect: "manual",
    });
    // A redirect here is google.com/sorry — the rate limiter, not a real answer.
    if (response.status >= 300 && response.status < 400) return "blocked";
    html = await response.text();
  } catch {
    return "blocked";
  }
  if (html.includes("/sorry/index") || html.includes("unusual traffic")) return "blocked";

  const data = parseYtInitialData(html);
  if (!data) return "blocked";

  let best: { id: string; title: string; channel: string } | null = null;
  walk(data, (node) => {
    if (best) return;
    const video = asObject(node.videoRenderer);
    const videoId = video?.videoId;
    if (typeof videoId !== "string" || !isValidYoutubeId(videoId)) return;
    best = {
      id: videoId,
      title: runText(video?.title),
      channel: runText(video?.ownerText) || runText(video?.longBylineText),
    };
  });
  return best;
}

/** oEmbed is the cheapest liveness check, and a 401 here is a dead embed. */
async function resolves(youtubeId: string): Promise<boolean> {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${youtubeId}`,
  )}`;
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(10_000) })).ok;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------- helpers

function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*\(From "[^"]+"\)/g, "")
    .replace(/\s*[-–|]\s*(Male|Female)\s*Version/gi, "")
    .replace(/\s*[-–|]\s*Duet/gi, "")
    .replace(/\s*\|.*$/, "")
    .replace(/\s*\(\s*(Happy|Sad)\s*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * YouTube's bootstrap JSON is a deep, undocumented, frequently-reshaped tree.
 * It is walked as `JsonObject` and every field read is optional-chained — the
 * shape is the server's to change, so nothing here may assume a path exists.
 */
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

/** Narrow a value to an object, for optional-chained field reads. */
function asObject(value: JsonValue | undefined): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

/** First `runs[0].text` under a node, which is how YouTube spells most labels. */
function runText(value: JsonValue | undefined): string {
  const runs = asObject(value)?.runs;
  const first = Array.isArray(runs) ? asObject(runs[0]) : undefined;
  return typeof first?.text === "string" ? first.text : "";
}

function parseYtInitialData(html: string): JsonObject | null {
  const marker = "var ytInitialData = ";
  const start = html.indexOf(marker);
  if (start === -1) return null;
  const end = html.indexOf(";</script>", start + marker.length);
  try {
    return JSON.parse(html.slice(start + marker.length, end));
  } catch {
    return null;
  }
}

function walk(node: JsonValue | undefined, visit: (record: JsonObject) => void): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
    return;
  }
  visit(node);
  for (const value of Object.values(node)) walk(value, visit);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Video titles from label channels are dense with metadata — the film, the
 * composer and often the year all sit in there. Pull what is unambiguous and
 * leave the rest for a human; a wrong composer is worse than a blank one.
 */
function guessFilm(youtubeTitle: string, known: string): string {
  if (known) return known;
  const parts = youtubeTitle.split("|").map((part) => part.trim());
  const movie = parts.find((part) => /(movie|padam)/i.test(part) && part.length < 40);
  return movie?.replace(/\s*(Tamil\s*)?(Movie|Padam)\s*(Songs?)?/i, "").trim() ?? "";
}

const COMPOSERS = [
  "Ilaiyaraaja",
  "A. R. Rahman",
  "Deva",
  "Vidyasagar",
  "Yuvan Shankar Raja",
  "Harris Jayaraj",
  "Srikanth Deva",
  "Devi Sri Prasad",
  "Bharadwaj",
  "Dhina",
  "Vijay Antony",
  "S. A. Rajkumar",
  "Sirpy",
  "Ranjit Barot",
];

function guessComposer(youtubeTitle: string): string {
  const haystack = youtubeTitle.replace(/\s+/g, " ").toLowerCase();
  for (const composer of COMPOSERS) {
    const needles = [composer.toLowerCase(), composer.toLowerCase().replace(/[.\s]/g, "")];
    if (
      needles.some((needle) =>
        haystack.replace(/[.\s]/g, "").includes(needle.replace(/[.\s]/g, "")),
      )
    )
      return composer;
  }
  return "";
}

function guessYear(youtubeTitle: string): number | null {
  const match = youtubeTitle.match(/\((19[89]\d|20[01]\d)\)/);
  return match ? Number(match[1]) : null;
}

// -------------------------------------------------------------------- output

function renderCandidates(candidates: Candidate[]): string {
  const entries = candidates
    .map((candidate) => {
      const film = guessFilm(candidate.youtubeTitle, candidate.film);
      const composer = guessComposer(candidate.youtubeTitle);
      const year = guessYear(candidate.youtubeTitle);
      const todo: string[] = [];
      if (!film) todo.push("movie");
      if (!composer) todo.push("composer");
      if (year === null) todo.push("year");
      todo.push("titleTa");

      return `  {
    // ${candidate.youtubeTitle.replace(/\*\//g, "*\\/")}
    // TODO(curator): ${todo.join(", ")}
    youtubeId: ${JSON.stringify(candidate.youtubeId)},
    title: ${JSON.stringify(candidate.title)},
    titleTa: "",
    movie: ${JSON.stringify(film)},
    year: ${year ?? 0},
    composer: ${JSON.stringify(composer)},
    era: "90s",
    vibe: "melody",
  },`;
    })
    .join("\n");

  return `import type { Track } from "@townbus/engine";

/**
 * GENERATED by \`bun run sync-playlist\` — do not hand-edit and do not import
 * from the app. This is the raw candidate pool from an upstream playlist.
 *
 * Every entry needs a human pass before it earns a place in \`tracks.ts\`:
 *   · fill \`titleTa\` (required — no Tamil title, no track)
 *   · confirm movie / year / composer; the guesses come from video titles
 *   · set \`era\` and \`vibe\` deliberately
 *   · apply the §7 filter: would you hear this through a blown speaker over
 *     engine noise, or is it just a good song of the era?
 *
 * Then move the keepers into \`tracks.ts\` and run \`bun run check-tracks\`.
 */
export const candidates: readonly Track[] = [
${entries}
];
`;
}

// ---------------------------------------------------------------------- main

async function main() {
  const args = process.argv.slice(2);
  const spotifyId = args[args.indexOf("--spotify") + 1];
  const youtubeId = args[args.indexOf("--youtube") + 1];

  if (!args.includes("--spotify") && !args.includes("--youtube")) {
    console.error(
      "usage: bun run sync-playlist -- --spotify <playlistId>\n" +
        "       bun run sync-playlist -- --youtube <playlistId>",
    );
    process.exit(1);
  }

  await mkdir(CACHE_DIR, { recursive: true });
  const cache: Cache = await Bun.file(CACHE_FILE)
    .json()
    .catch(() => ({}));

  let candidates: Candidate[];

  if (args.includes("--youtube")) {
    // A YouTube playlist already *is* video IDs — nothing to search for.
    candidates = await readYoutubePlaylist(youtubeId as string);
  } else {
    const sources = await readSpotifyPlaylist(spotifyId as string);
    candidates = [];

    for (const [index, source] of sources.entries()) {
      const query = `${source.title} ${source.film} ${source.artists
        .split(",")
        .slice(0, 2)
        .join(" ")} tamil movie video song`.replace(/\s+/g, " ");

      let hit = cache[query];
      if (hit === undefined) {
        let result = await searchYoutube(query);
        let cooldown = BLOCK_COOLDOWN_MS;
        while (result === "blocked") {
          console.log(`  rate-limited; waiting ${cooldown / 1000}s`);
          await sleep(cooldown);
          cooldown = Math.min(cooldown * 2, MAX_COOLDOWN_MS);
          result = await searchYoutube(query);
        }
        hit = result;
        cache[query] = hit;
        await Bun.write(CACHE_FILE, JSON.stringify(cache, null, 2));
        await sleep(SEARCH_DELAY_MS + Math.random() * SEARCH_JITTER_MS);
      }

      const position = `${String(index + 1).padStart(3)}/${sources.length}`;
      if (!hit) {
        console.log(`${position}  ✗ no match — ${source.title}`);
        continue;
      }
      console.log(`${position}  ${hit.id}  ${source.title}  ←  ${hit.channel}`);
      candidates.push({
        ...source,
        youtubeId: hit.id,
        youtubeTitle: hit.title,
        channel: hit.channel,
      });
    }
  }

  // Drop anything that will not embed — a 401 here is tomorrow's error 150.
  console.log(`\nverifying ${candidates.length} video IDs via oEmbed…`);
  const live: Candidate[] = [];
  for (const candidate of candidates) {
    if (await resolves(candidate.youtubeId)) live.push(candidate);
    else console.log(`  ✗ dropped ${candidate.youtubeId} — ${candidate.title} (will not embed)`);
  }

  const seen = new Set<string>();
  const unique = live.filter((candidate) => {
    if (seen.has(candidate.youtubeId)) return false;
    seen.add(candidate.youtubeId);
    return true;
  });

  await Bun.write(OUT_FILE, renderCandidates(unique));

  const needsTamil = unique.filter((candidate) => !containsTamil(candidate.title)).length;
  console.log(
    `\n✓ ${unique.length} candidates → packages/content/src/tracks.candidates.ts\n` +
      `  ${needsTamil} still need a Tamil title before they can ship.\n` +
      "  Prune into tracks.ts, then run: bun run check-tracks\n",
  );
}

await main();
