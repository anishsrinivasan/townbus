"use client";

import { backdropVideoUrl, type Orientation, type Period, resolveMode } from "@townbus/engine";
import { useEffect, useRef, useState } from "react";
import { PERIOD_EVENT, readMode } from "./settings-dialog";

/**
 * The moving backdrop (PRD §9 P2).
 *
 * Exactly one loop is ever loaded — picked from the viewer's day/night mode and
 * the current orientation — and the matching still fades off it once it is
 * actually playing. The still is the real backdrop: it paints instantly,
 * survives a slow connection, and is all a visitor with JavaScript off or
 * reduced motion on will ever see.
 *
 * The loop is rendered into the document straight away and sits *underneath*
 * the stills, which is what makes that safe — an element that never loads is
 * simply never revealed. It deliberately does not preload detached and attach
 * on `canplay`: WebKit will not fetch media for an element outside the
 * document, so on iOS that readiness event never arrives and the loop never
 * appears at all.
 */
export default function BackdropVideo() {
  const [variant, setVariant] = useState<{ period: Period; orientation: Orientation } | null>(null);
  const [ready, setReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the variant
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !variant) return;

    setReady(false);
    let cancelled = false;

    /**
     * iOS only treats a video as autoplay-eligible when `muted` is present as a
     * content *attribute*. React sets the IDL property, which reflects to
     * `defaultMuted` and not to the attribute, so WebKit never sees it and
     * refuses to start. Both are set here, before the first play attempt.
     */
    video.defaultMuted = true;
    video.muted = true;
    video.setAttribute("muted", "");

    // Reveal on `playing`, not `canplay` — `canplay` only means enough has
    // buffered, and fading the still off then can expose a frame that is not
    // being painted yet.
    const onPlaying = () => {
      if (!cancelled) setReady(true);
    };
    video.addEventListener("playing", onPlaying);

    const attempt = () => {
      if (cancelled) return;
      void video.play().catch(() => {
        // Refused — the still stays and one of the retries below has another go.
      });
    };

    /**
     * The retries are the whole trick. On a cold load `play()` is called while
     * `readyState` is still 0, and WebKit rejects a play on a video with no
     * data rather than queueing it — which is why the loop would only ever
     * start after a day/night switch happened to call it again on a warm cache.
     * So: try now, try again the moment data lands, and once more on the first
     * touch in case Low Power Mode or a cellular policy refused it outright.
     */
    attempt();
    video.addEventListener("loadeddata", attempt);
    video.addEventListener("canplay", attempt);

    const onGesture = () => attempt();
    window.addEventListener("pointerdown", onGesture, { once: true, passive: true });
    window.addEventListener("touchstart", onGesture, { once: true, passive: true });

    // Coming back to a backgrounded tab also drops the loop on iOS.
    const onVisible = () => {
      if (document.visibilityState === "visible" && video.paused) attempt();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("loadeddata", attempt);
      video.removeEventListener("canplay", attempt);
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("touchstart", onGesture);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [variant?.period, variant?.orientation]);

  if (!variant) return null;

  return (
    <video
      // Remount on variant change so the browser drops the previous download.
      key={`${variant.period}-${variant.orientation}`}
      ref={videoRef}
      className="backdrop-video"
      data-ready={ready}
      src={backdropVideoUrl(variant.period, variant.orientation, "mp4")}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      // Keep the loop off AirPlay and the picture-in-picture menu.
      disableRemotePlayback
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
