"use client";

import { useEffect, useState } from "react";
import { placeholderListenerCount } from "@/lib/presence";
import LinkOuts from "./link-outs";
import SearchDialog from "./search-dialog";
import SettingsDialog from "./settings-dialog";

/** IST wall clock — the page is set in Tamil Nadu wherever it is opened. */
const IST_TIME = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const IST_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function istHourMinute(now: Date): [number, number] {
  const [hour = "0", minute = "0"] = IST_PARTS.format(now).split(":");
  return [Number(hour), Number(minute)];
}

/**
 * Clock, listener count and link-outs.
 *
 * The clock and count are rendered empty on the server and filled on mount —
 * a static export is built once, so anything time-dependent has to arrive
 * after hydration or the markup and the browser disagree.
 */
export default function TopBar() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const [hour, minute] = now ? istHourMinute(now) : [0, 0];

  return (
    // A three-column grid, not `justify-between`: the clock and the link-outs
    // are different widths, so space-between would leave the listener count
    // sitting off-centre. Equal `1fr` gutters put it in the true middle.
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4 sm:gap-4 sm:px-8 sm:py-6">
      <span
        className="justify-self-start font-mono text-[0.7rem] text-[color:var(--tb-cream)]/70 tabular-nums drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] sm:text-[0.8rem]"
        suppressHydrationWarning
      >
        {now ? IST_TIME.format(now).toLowerCase() : " "}
      </span>

      {/* Listener count slot — placeholder until the Phase 2 Durable Object. */}
      <span
        className="flex items-center justify-center gap-2 whitespace-nowrap text-[0.75rem] text-[color:var(--tb-cream)]/80 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] sm:text-[0.82rem]"
        suppressHydrationWarning
      >
        {now && (
          <>
            <span className="pulse-dot" />
            <span className="tabular-nums">{placeholderListenerCount(hour, minute)}</span>
            <span className="text-[color:var(--tb-cream)]/55">online</span>
          </>
        )}
      </span>

      <div className="flex items-center justify-self-end sm:gap-3">
        <LinkOuts />
        <SearchDialog />
        <SettingsDialog />
      </div>
    </div>
  );
}
