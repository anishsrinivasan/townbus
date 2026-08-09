/**
 * The track model. Content-as-code: every field is authored by hand in
 * `@townbus/content` and reviewed via PR. Nothing here touches the network.
 */

export type Era = "80s" | "90s" | "2000s";

export type Vibe = "kuthu" | "gaana" | "melody" | "folk";

export type Track = {
  /** 11-char YouTube video ID. Also keys cover art at i.ytimg.com/vi/{id}/... */
  youtubeId: string;
  /** Latin transliteration of the song title. */
  title: string;
  /** தமிழ் title — required; half the emotional payload of the page. */
  titleTa: string;
  movie: string;
  year: number;
  composer: string;
  era: Era;
  vibe: Vibe;
};

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function isValidYoutubeId(id: string): boolean {
  return YOUTUBE_ID.test(id);
}

/**
 * Derives the era bucket from a release year, so `tracks.ts` entries can be
 * cross-checked instead of trusted. Up to 1989 → 80s, 1990–1999 → 90s, else 2000s.
 */
export function eraForYear(year: number): Era {
  if (year < 1990) return "80s";
  if (year < 2000) return "90s";
  return "2000s";
}

/**
 * Era scope. The PRD opens at 1985, but the curated town-bus playlists that
 * feed `tracks.ts` are anchored by early-80s Ilaiyaraaja that never stopped
 * playing on those buses, so the floor sits at 1980.
 */
export const EARLIEST_YEAR = 1980;
export const LATEST_YEAR = 2010;

export type TrackProblem = {
  index: number;
  youtubeId: string;
  field: string;
  message: string;
};

/**
 * Structural validation of an authored track list. Pure — no network, so this
 * runs in unit tests and in the `check-tracks` script before the oEmbed pass.
 */
export function validateTracks(tracks: readonly Track[]): TrackProblem[] {
  const problems: TrackProblem[] = [];
  const seen = new Map<string, number>();

  tracks.forEach((track, index) => {
    const at = (field: string, message: string) => {
      problems.push({ index, youtubeId: track.youtubeId, field, message });
    };

    if (!isValidYoutubeId(track.youtubeId)) {
      at("youtubeId", `"${track.youtubeId}" is not an 11-char YouTube video ID`);
    }
    const duplicateOf = seen.get(track.youtubeId);
    if (duplicateOf !== undefined) {
      at("youtubeId", `duplicate of track at index ${duplicateOf}`);
    } else {
      seen.set(track.youtubeId, index);
    }

    if (track.title.trim() === "") at("title", "missing");
    if (track.titleTa.trim() === "") at("titleTa", "missing Tamil title");
    if (!containsTamil(track.titleTa)) {
      at("titleTa", `"${track.titleTa}" contains no Tamil script`);
    }
    if (track.movie.trim() === "") at("movie", "missing");
    if (track.composer.trim() === "") at("composer", "missing");
    if (!Number.isInteger(track.year) || track.year < EARLIEST_YEAR || track.year > LATEST_YEAR) {
      at("year", `${track.year} is outside the ${EARLIEST_YEAR}–${LATEST_YEAR} era scope`);
    } else if (track.era !== eraForYear(track.year)) {
      at("era", `"${track.era}" does not match year ${track.year}`);
    }
  });

  return problems;
}

/** Tamil Unicode block: U+0B80–U+0BFF. */
const TAMIL_RANGE = /[஀-௿]/;

export function containsTamil(value: string): boolean {
  return TAMIL_RANGE.test(value);
}
