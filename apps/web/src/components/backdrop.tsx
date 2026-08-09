import { backdropUrl, type Period } from "@townbus/engine";
import BackdropVideo from "./backdrop-video";

/**
 * The period × orientation backdrop matrix.
 *
 * Both periods are in the DOM and CSS picks one off `<html data-period>`, set
 * by the blocking resolver in <head>, so the right one is showing before first
 * paint and the day/night switch is a single attribute write.
 */
function Backdrop({ period }: { period: Period }) {
  const source = (orientation: "landscape" | "portrait", type: "avif" | "webp") => (
    <source
      type={`image/${type}`}
      media={orientation === "portrait" ? "(orientation: portrait)" : undefined}
      srcSet={`${backdropUrl(period, orientation, "half", type)} 1280w, ${backdropUrl(
        period,
        orientation,
        "full",
        type,
      )} 2560w`}
      sizes="70vw"
    />
  );

  return (
    <div className={`backdrop backdrop--${period}`} aria-hidden="true">
      <picture>
        {source("portrait", "avif")}
        {source("portrait", "webp")}
        <source
          media="(orientation: portrait)"
          type="image/jpeg"
          srcSet={`${backdropUrl(period, "portrait", "half", "jpg")} 1280w, ${backdropUrl(
            period,
            "portrait",
            "full",
            "jpg",
          )} 2560w`}
          sizes="70vw"
        />
        {source("landscape", "avif")}
        {source("landscape", "webp")}
        {/*
          Eager and high priority: this is the largest thing on the page and
          the reason anyone stays on it. Lazy-loading it costs seconds of blank
          page while the AVIF is fetched and decoded. Both periods load so the
          day/night switch is instant — one extra ~130 KB image, on a page whose
          entire point is the artwork.
        */}
        <img
          src={backdropUrl(period, "landscape", "full", "jpg")}
          srcSet={`${backdropUrl(period, "landscape", "half", "jpg")} 1280w, ${backdropUrl(
            period,
            "landscape",
            "full",
            "jpg",
          )} 2560w`}
          sizes="70vw"
          alt=""
          loading="eager"
          fetchPriority={period === "night" ? "high" : "low"}
          decoding="async"
        />
      </picture>
    </div>
  );
}

/**
 * The stage isolates its own blending group. Without `isolation: isolate` the
 * grain's `mix-blend-mode` resolves against the root canvas — which the body's
 * near-black background paints — instead of against the artwork, and the whole
 * page comes out black.
 */
export default function Backdrops() {
  return (
    // The loop goes first, underneath the stills, and the stills fade off it
    // once it is playing — so the artwork is never waiting on a video.
    <div className="stage" aria-hidden="true">
      <BackdropVideo />
      <Backdrop period="night" />
      <Backdrop period="morning" />
      <div className="scrim" />
      <div className="grain" />
    </div>
  );
}
