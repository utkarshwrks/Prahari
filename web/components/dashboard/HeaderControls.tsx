"use client";

import { Volume2, VolumeX, MessageSquare, MessageSquareOff } from "lucide-react";
import { useIntel, FEED_MODES, type FeedMode } from "@/store/intel";

const MODE_HINT: Record<FeedMode, string> = {
  DEMO: "Synthetic feed. Boosted rate, guaranteed early in-zone breaches.",
  DATASET: "Real listings from the engine (public academic archives).",
  LIVE: "Real public OSINT: Hacker News, Google News, Reddit.",
};

export default function HeaderControls() {
  const mode = useIntel((s) => s.mode);
  const setMode = useIntel((s) => s.setMode);
  const muted = useIntel((s) => s.muted);
  const toggleMute = useIntel((s) => s.toggleMute);
  const toastsEnabled = useIntel((s) => s.toastsEnabled);
  const toggleToasts = useIntel((s) => s.toggleToasts);

  return (
    <div className="flex items-center gap-2">
      {/* Three-way feed source. Switching clears the feed and the map but keeps
          the cumulative counters and the alert log — v1 setDemoMode semantics. */}
      <div
        data-tour="demo"
        role="radiogroup"
        aria-label="Feed source"
        className="mono flex items-stretch border border-border bg-panel-2"
      >
        {FEED_MODES.map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              role="radio"
              aria-checked={active}
              onClick={() => setMode(m)}
              title={MODE_HINT[m]}
              className={`px-2.5 py-1.5 text-[10px] uppercase tracking-[0.15em] transition ${
                active
                  ? "bg-red/15 text-red-bright shadow-glow-sm"
                  : "text-muted hover:text-text"
              }`}
            >
              {m}
            </button>
          );
        })}
      </div>

      <button
        onClick={toggleToasts}
        title={toastsEnabled ? "Stop alert pop-ups" : "Enable alert pop-ups"}
        className={`flex h-7 w-7 items-center justify-center border transition ${
          toastsEnabled
            ? "border-red/50 bg-red/10 text-red-bright"
            : "border-border bg-panel-2 text-muted hover:text-text"
        }`}
      >
        {toastsEnabled ? <MessageSquare className="h-3.5 w-3.5" /> : <MessageSquareOff className="h-3.5 w-3.5" />}
      </button>

      <button
        onClick={toggleMute}
        title={muted ? "Unmute breach sound" : "Mute breach sound"}
        className={`flex h-7 w-7 items-center justify-center border transition ${
          muted
            ? "border-border bg-panel-2 text-muted hover:text-text"
            : "border-red/50 bg-red/10 text-red-bright"
        }`}
      >
        {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
