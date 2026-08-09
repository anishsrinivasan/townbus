import { site } from "@/lib/site";

/**
 * The title lockup. Real HTML text, selectable and indexable — no Tamil on this
 * page comes from a raster (PRD §10). The painted-sign treatment is entirely
 * CSS (`.lockup-ta` in index.css).
 *
 * The break is explicit rather than left to wrapping: two lines on a phone,
 * one on anything wider. Tamil glyphs are wide and deep, so a single line at a
 * size that fills a desktop runs off a 390px screen and drops its descenders
 * into the Latin line underneath.
 */
export default function Lockup() {
  return (
    <header className="flex flex-col items-center text-center">
      {/* The one place the Tamil display face is used — this is the logo. */}
      <h1 className="lockup-ta text-[clamp(2.15rem,8.5vw,4.75rem)]" lang="ta">
        <span>டவுன் பஸ்</span> <span className="block sm:inline">ஹிட்ஸ்</span>
      </h1>
      <p className="lockup-la mt-3 text-[clamp(0.58rem,2.1vw,0.85rem)] uppercase sm:mt-4">
        {site.titleLatin}
      </p>
    </header>
  );
}
