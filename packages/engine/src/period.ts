/**
 * Day/night resolver. The page is set in Tamil Nadu regardless of where it is
 * being viewed from, so the period is always resolved against IST — a fixed
 * UTC+05:30 offset with no DST, which is why plain arithmetic is safe here.
 */

export type Period = "morning" | "night";

/**
 * What the viewer asked for. `system` follows the IST clock, which is the
 * default and the whole point of the day/night swap; the other two pin it.
 */
export type PeriodMode = "system" | Period;

export const PERIOD_MODES: readonly PeriodMode[] = ["system", "morning", "night"];

/** localStorage key holding the viewer's `PeriodMode`. */
export const PERIOD_STORAGE_KEY = "townbus:period";

const IST_OFFSET_MINUTES = 5 * 60 + 30;
const MORNING_START_HOUR = 5;
const NIGHT_START_HOUR = 18;

/** Hour of day (0–23) in IST for the given instant. */
export function istHour(now: Date): number {
  const istMinutes = Math.floor(now.getTime() / 60000) + IST_OFFSET_MINUTES;
  const minutesIntoDay = ((istMinutes % 1440) + 1440) % 1440;
  return Math.floor(minutesIntoDay / 60);
}

/** Morning 05:00–17:59 IST, night otherwise. Clock is injected, never read. */
export function resolvePeriod(now: Date): Period {
  const hour = istHour(now);
  return hour >= MORNING_START_HOUR && hour < NIGHT_START_HOUR ? "morning" : "night";
}

/** Applies a stored mode, falling back to the IST clock. */
export function resolveMode(mode: PeriodMode, now: Date): Period {
  return mode === "system" ? resolvePeriod(now) : mode;
}

/**
 * The same resolver as a self-contained snippet for a blocking <script> in
 * <head>. It has to run before the bundle loads or the backdrop visibly swaps
 * after first paint, which rules out importing anything.
 *
 * Reads the viewer's pinned mode first, then falls back to the clock. Night is
 * the CSS default and this only ever *adds* an attribute, so a page with
 * JavaScript off still renders the night backdrop rather than nothing.
 * `period.test.ts` runs this string against the same cases as `resolvePeriod`.
 */
export function periodScript(): string {
  return (
    "(function(){try{" +
    `var s=localStorage.getItem(${JSON.stringify(PERIOD_STORAGE_KEY)}),p;` +
    'if(s==="morning"||s==="night"){p=s}else{' +
    `var m=Math.floor(Date.now()/6e4)+${IST_OFFSET_MINUTES},` +
    "h=Math.floor((((m%1440)+1440)%1440)/60);" +
    `p=(h>=${MORNING_START_HOUR}&&h<${NIGHT_START_HOUR})?"morning":"night"}` +
    "document.documentElement.dataset.period=p;" +
    "}catch(e){}})()"
  );
}
