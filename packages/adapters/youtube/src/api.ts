/**
 * Loads the YouTube IFrame Player API exactly once per document.
 *
 * The API is a global singleton with a single global ready callback, so every
 * consumer has to share one promise — React StrictMode double-mounts alone will
 * otherwise inject the script twice and clobber `onYouTubeIframeAPIReady`.
 */

const SCRIPT_SRC = "https://www.youtube.com/iframe_api";

export type YT = {
  Player: new (element: HTMLElement | string, options: unknown) => YTPlayerInstance;
  PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };
};

/** The subset of the IFrame API surface this adapter actually calls. */
export type YTPlayerInstance = {
  loadVideoById(id: string): void;
  cueVideoById(id: string): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  setVolume(volume: number): void;
  getVolume(): number;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getPlayerState(): number;
  destroy(): void;
};

declare global {
  interface Window {
    YT?: YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let pending: Promise<YT> | null = null;

export function loadYouTubeApi(): Promise<YT> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube IFrame API requires a browser"));
  }
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (pending) return pending;

  pending = new Promise<YT>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      const api = window.YT;
      if (api?.Player) resolve(api);
      else reject(new Error("YouTube IFrame API loaded without a Player constructor"));
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) return;

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onerror = () => {
      pending = null;
      reject(new Error("Failed to load the YouTube IFrame API"));
    };
    document.head.appendChild(script);
  });

  return pending;
}

/** Test seam — resets the module-level singleton between cases. */
export function resetYouTubeApiLoader(): void {
  pending = null;
}
