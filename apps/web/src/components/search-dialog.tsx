"use client";

import { tracks } from "@townbus/content";
import { coverUrl, searchTracks } from "@townbus/engine";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@townbus/ui/components/command";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/**
 * Fired when a song is picked. The trigger lives in the header and the queue
 * lives at the bottom of the page, so an event beats threading a callback
 * through the layout or lifting the whole player into a context — the same
 * pattern the day/night switch already uses.
 */
export const SELECT_TRACK_EVENT = "townbus:select-track";

/**
 * Song search.
 *
 * Ranking lives in `searchTracks` in the engine, where it is pure and tested;
 * this only renders the result. `shouldFilter={false}` is what hands control
 * over — cmdk's own fuzzy filter would otherwise re-sort the list and undo the
 * field-weighted ordering, and it cannot match Tamil typed in Tamil.
 */
export default function SearchDialog({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = useMemo(() => searchTracks(tracks, query, 50), [query]);

  // ⌘K / Ctrl-K to open, "/" as the plain-keyboard shortcut people expect.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.closest("input, textarea, [contenteditable=true]");

      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      } else if (event.key === "/" && !typing && !open) {
        event.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Start each visit from a clean slate rather than the last thing searched.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search songs"
        className={`grid size-9 place-items-center rounded-full text-[color:var(--tb-cream)]/80 transition-colors hover:text-[color:var(--tb-amber)] focus-visible:outline-2 focus-visible:outline-[color:var(--tb-amber)] focus-visible:outline-offset-2 ${className}`}
      >
        <Search className="size-[1.1rem] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search songs"
        description="Search by song, film or composer, in Tamil or English."
        className="search-palette"
      >
        <Command shouldFilter={false} className="bg-transparent">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Song, film or composer — தமிழிலும் தேடலாம்"
          />
          <CommandList className="max-h-[60vh]">
            <CommandEmpty>Nothing here by that name.</CommandEmpty>
            {results.map(({ track, matchedOn }) => (
              <CommandItem
                key={track.youtubeId}
                // cmdk selects by `value`; filtering is off, but the value must
                // still be unique or arrowing through the list lands on the
                // wrong row whenever two songs share a title.
                value={track.youtubeId}
                onSelect={() => {
                  window.dispatchEvent(
                    new CustomEvent(SELECT_TRACK_EVENT, { detail: track.youtubeId }),
                  );
                  setOpen(false);
                }}
                className="gap-3"
              >
                {/* biome-ignore lint/performance/noImgElement: static export has no image optimiser */}
                <img
                  src={coverUrl(track.youtubeId)}
                  alt=""
                  width={40}
                  height={40}
                  loading="lazy"
                  decoding="async"
                  className="size-10 shrink-0 rounded-md object-cover"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[0.9rem]" lang="ta">
                    {track.titleTa}
                  </span>
                  <span className="truncate text-[0.72rem] opacity-60">
                    {track.title} · {track.movie} · {track.year} · {track.composer}
                  </span>
                </span>
                {/* Say why a row is here when the song title was not the match. */}
                {matchedOn !== "title" && matchedOn !== "titleTa" && (
                  <span className="shrink-0 text-[0.62rem] uppercase tracking-[0.12em] opacity-45">
                    {matchedOn}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
