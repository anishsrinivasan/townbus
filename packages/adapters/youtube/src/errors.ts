/**
 * YouTube player error codes, and the question the engine actually cares about:
 * is this video gone for good, or did something transient go wrong?
 */

export const YT_ERROR = {
  /** The request contained an invalid parameter value. */
  INVALID_PARAM: 2,
  /** The requested content cannot be played in an HTML5 player. */
  HTML5: 5,
  /** The video has been removed or marked private. */
  NOT_FOUND: 100,
  /** The owner does not allow embedded playback. */
  EMBED_DISALLOWED: 101,
  /** Same as 101 — YouTube reports this one inconsistently. */
  EMBED_DISALLOWED_ALT: 150,
} as const;

/**
 * 100 / 101 / 150 mean the ID will never play here again, so the track is
 * retired for the session and the queue moves on. Anything else (2, 5, or an
 * unknown code) is treated as transient and left to the caller.
 */
const PERMANENT: readonly number[] = [
  YT_ERROR.NOT_FOUND,
  YT_ERROR.EMBED_DISALLOWED,
  YT_ERROR.EMBED_DISALLOWED_ALT,
];

export function isPermanentError(code: number): boolean {
  return PERMANENT.includes(code);
}

export function describeError(code: number): string {
  switch (code) {
    case YT_ERROR.INVALID_PARAM:
      return "invalid video ID";
    case YT_ERROR.HTML5:
      return "not playable in an HTML5 player";
    case YT_ERROR.NOT_FOUND:
      return "video removed or private";
    case YT_ERROR.EMBED_DISALLOWED:
    case YT_ERROR.EMBED_DISALLOWED_ALT:
      return "embedding disabled by the owner";
    default:
      return `unknown player error ${code}`;
  }
}
