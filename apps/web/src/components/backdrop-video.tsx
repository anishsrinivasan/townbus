"use client";

import { backdropVideoUrl, type Orientation, type Period, resolveMode } from "@townbus/engine";
import { useEffect, useRef, useState } from "react";
import { PERIOD_EVENT, readMode } from "./settings-dialog";

/**
 * The moving backdrop (PRD §9 P2).
 *
 * Exactly one loop is ever loaded — picked from the viewer's day/night mode and
 * the current orientation — and the matching still fades off it once it plays.
 * The still is the real backdrop: it paints instantly, survives a slow
 * connection, and is all a visitor with JavaScript off or reduced motion on
 * will ever see.
 *
 * The element is built detached, loaded, and only put in the document once it
 * reports `canplay`, so a loop that stalls or 404s is a no-op rather than a
 * black rectangle sitting over the artwork waiting for bytes.
 */
export default function BackdropVideo() {
  const [variant, setVariant] = useState<{ period: Period; orientation: Orientation } | null>(null);
  const [ready, setReady] = useState(false);
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // A loop of a bus swaying is decoration. If motion is unwelcome, or the
    // visitor asked the browser to save data, the still is the whole answer.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const connection = (
      navigator as { connection?: { saveData?: boolean; effectiveType?: string } }
    ).connection;
    if (connection?.saveData) return;
    if (connection?.effectiveType && /^(slow-)?2g$/.test(connection.effectiveType)) return;

    const portrait = window.matchMedia("(orientation: portrait)");
    const apply = () =>
      setVariant({
        period: resolveMode(readMode(), new Date()),
        orientation: portrait.matches ? "portrait" : "landscape",
      });

    apply();
    portrait.addEventListener("change", apply);
    // Flipping the day/night switch has to change the loop, not just the still.
    window.addEventListener(PERIOD_EVENT, apply);
    return () => {
      portrait.removeEventListener("change", apply);
      window.removeEventListener(PERIOD_EVENT, apply);
    };
  }, []);

  useEffect(() => {
    if (!variant) return;
    setReady(false);

    const video = document.createElement("video");
    video.className = "backdrop-video";
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute("aria-hidden", "true");
    video.tabIndex = -1;
    video.src = backdropVideoUrl(variant.period, variant.orientation, "mp4");

    let cancelled = false;

    const attach = () => {
      if (cancelled || !hostRef.current) return;
      hostRef.current.appendChild(video);
      void video.play().catch(() => {
        // Autoplay refused even while muted — leave the still in place.
      });
      setReady(true);
    };

    video.addEventListener("canplay", attach, { once: true });
    video.load();

    return () => {
      cancelled = true;
      video.removeEventListener("canplay", attach);
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.remove();
    };
  }, [variant]);

  return (
    <div ref={hostRef} className="backdrop-video-host" data-ready={ready} aria-hidden="true" />
  );
}
