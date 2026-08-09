import { linkOuts } from "@townbus/adapter-links";
import { mirrors, site } from "@/lib/site";
import { ArrowUpRight, SpotifyMark, YouTubeMusicMark } from "./brand-icons";

const MARKS = {
  Spotify: SpotifyMark,
  "YT Music": YouTubeMusicMark,
} as const;

/**
 * Spotify / YT Music link-outs. Plain anchors, rendered on the server: with
 * JavaScript off these are the whole product — the page degrades to link-out
 * mode without changing a line (PRD §10).
 *
 * Deliberately quiet — mark, label, arrow, no chrome. They sit over painted
 * artwork and should not compete with it.
 */
export default function LinkOuts({ className = "" }: { className?: string }) {
  const links = linkOuts(mirrors, `${site.titleLatin} Tamil`);

  return (
    <nav aria-label="Listen elsewhere" className={`flex items-center sm:gap-4 ${className}`}>
      {links.map((link) => {
        const Mark = MARKS[link.label as keyof typeof MARKS];
        return (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noreferrer noopener"
            className="group grid size-9 place-items-center rounded-full text-[color:var(--tb-cream)]/85 text-[0.82rem] transition-colors hover:text-[color:var(--tb-amber)] focus-visible:outline-2 focus-visible:outline-[color:var(--tb-amber)] focus-visible:outline-offset-2 sm:flex sm:size-auto sm:gap-1.5"
          >
            {Mark && (
              <Mark className="size-[1.15rem] shrink-0 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />
            )}
            {/* On a phone the marks alone carry it — the labels would crowd the
                listener count out of the middle of the row. */}
            <span className="sr-only drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] sm:not-sr-only">
              {link.label}
            </span>
            <ArrowUpRight className="hidden size-3.5 opacity-55 transition-opacity group-hover:opacity-100 sm:block" />
          </a>
        );
      })}
    </nav>
  );
}
