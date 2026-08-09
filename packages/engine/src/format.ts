/** Seek-bar formatting. m:ss, or h:mm:ss for the rare long upload. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const total = Math.floor(seconds);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);

  const pad = (value: number) => value.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** 0–1 progress through a track, clamped. 0 when the duration isn't known yet. */
export function progressRatio(elapsed: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(1, Math.max(0, elapsed / duration));
}
