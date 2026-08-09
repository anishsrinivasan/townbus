"use client";

import { Dialog } from "@base-ui/react/dialog";
import { PERIOD_STORAGE_KEY, type PeriodMode, resolveMode } from "@townbus/engine";
import { Check, Clock, Moon, Settings, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/** Fired when the mode changes, so the backdrop loop can swap files with it. */
export const PERIOD_EVENT = "townbus:period";

const OPTIONS: { mode: PeriodMode; label: string; hint: string; Icon: typeof Sun }[] = [
  { mode: "system", label: "Auto", hint: "Follows the clock in Tamil Nadu", Icon: Clock },
  { mode: "morning", label: "Day", hint: "Morning route, sun through the window", Icon: Sun },
  { mode: "night", label: "Night", hint: "Last bus home", Icon: Moon },
];

export function readMode(): PeriodMode {
  try {
    const stored = localStorage.getItem(PERIOD_STORAGE_KEY);
    return stored === "morning" || stored === "night" ? stored : "system";
  } catch {
    return "system";
  }
}

/**
 * Settings — currently just the day/night switch.
 *
 * A sheet rather than a dropdown: a menu of two-line rows was cramped and ugly
 * at desktop scale and unusable at phone scale, where the right thing is
 * something that comes up from the bottom edge under your thumb. Same component
 * both ways — bottom sheet on a phone, centred panel on a desktop.
 *
 * The blocking script in <head> has already applied the stored mode before
 * first paint; this only keeps it in step afterwards. Writing `data-period` on
 * <html> is what actually swaps the backdrop — the CSS and the video loop both
 * key off it — so choosing is one attribute write, not a re-render.
 */
export default function SettingsDialog({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<PeriodMode>("system");

  useEffect(() => setMode(readMode()), []);

  /** `system` has to be re-resolved as the clock crosses 05:00 and 18:00. */
  useEffect(() => {
    if (mode !== "system") return;
    const id = window.setInterval(() => {
      document.documentElement.dataset.period = resolveMode("system", new Date());
    }, 60_000);
    return () => window.clearInterval(id);
  }, [mode]);

  const choose = (next: PeriodMode) => {
    setMode(next);
    try {
      if (next === "system") localStorage.removeItem(PERIOD_STORAGE_KEY);
      else localStorage.setItem(PERIOD_STORAGE_KEY, next);
    } catch {
      // Private mode: the choice just does not survive a reload.
    }
    const period = resolveMode(next, new Date());
    document.documentElement.dataset.period = period;
    window.dispatchEvent(new CustomEvent(PERIOD_EVENT, { detail: period }));
  };

  return (
    <Dialog.Root>
      <Dialog.Trigger
        aria-label="Settings"
        className={`grid size-9 place-items-center rounded-full text-[color:var(--tb-cream)]/80 transition-colors hover:text-[color:var(--tb-amber)] focus-visible:outline-2 focus-visible:outline-[color:var(--tb-amber)] focus-visible:outline-offset-2 ${className}`}
      >
        <Settings className="size-[1.15rem] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="sheet-backdrop" />
        <Dialog.Viewport className="sheet-viewport">
          <Dialog.Popup className="sheet backdrop-blur-3xl backdrop-saturate-200">
            {/* Grab handle — reads as draggable on a phone even though the
                sheet is dismissed by tapping out or pressing Escape. */}
            <div className="sheet-grip" aria-hidden="true" />

            <Dialog.Title className="px-1 pb-1 font-semibold text-[1.05rem] text-[color:var(--tb-cream)]">
              Settings
            </Dialog.Title>
            <Dialog.Description className="px-1 pb-4 text-[0.78rem] text-[color:var(--tb-muted)]">
              The page follows the light in Tamil Nadu. Pin it if you'd rather it didn't.
            </Dialog.Description>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="sr-only">Time of day</legend>
              {OPTIONS.map(({ mode: option, label, hint, Icon }) => {
                const active = mode === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => choose(option)}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-3.5 rounded-2xl px-3.5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[color:var(--tb-amber)] focus-visible:outline-offset-2 ${
                      active
                        ? "bg-[color:oklch(0.95_0.02_82/0.14)]"
                        : "hover:bg-[color:oklch(0.95_0.02_82/0.07)]"
                    }`}
                  >
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-full ${
                        active
                          ? "bg-[color:var(--tb-amber)] text-[color:var(--tb-night-deep)]"
                          : "bg-[color:oklch(0.95_0.02_82/0.1)] text-[color:var(--tb-cream)]/75"
                      }`}
                    >
                      <Icon className="size-[1.05rem]" />
                    </span>

                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[0.92rem] text-[color:var(--tb-cream)] leading-tight">
                        {label}
                      </span>
                      <span className="text-[0.74rem] text-[color:var(--tb-muted)] leading-tight">
                        {hint}
                      </span>
                    </span>

                    {active && <Check className="size-4 shrink-0 text-[color:var(--tb-amber)]" />}
                  </button>
                );
              })}
            </fieldset>

            <Dialog.Close className="mt-4 w-full rounded-2xl bg-[color:oklch(0.95_0.02_82/0.1)] py-3 text-[0.88rem] text-[color:var(--tb-cream)] transition-colors hover:bg-[color:oklch(0.95_0.02_82/0.16)] focus-visible:outline-2 focus-visible:outline-[color:var(--tb-amber)] focus-visible:outline-offset-2">
              Done
            </Dialog.Close>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
