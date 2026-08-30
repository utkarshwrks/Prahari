"use client";

import { Volume2, VolumeX, Zap, MessageSquare, MessageSquareOff } from "lucide-react";
import { useIntel } from "@/store/intel";

export default function HeaderControls() {
  const demoMode = useIntel((s) => s.demoMode);
  const setDemoMode = useIntel((s) => s.setDemoMode);
  const muted = useIntel((s) => s.muted);
  const toggleMute = useIntel((s) => s.toggleMute);
  const toastsEnabled = useIntel((s) => s.toastsEnabled);
  const toggleToasts = useIntel((s) => s.toggleToasts);

  return (
    <div className="flex items-center gap-2">
      <button
        data-tour="demo"
        onClick={() => setDemoMode(!demoMode)}
        title="Demo mode boosts intercept rate & guarantees early breaches"
        className={`mono flex items-center gap-1.5 border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.15em] transition ${
          demoMode
            ? "border-red bg-red/10 text-red-bright shadow-glow-sm"
            : "border-border bg-panel-2 text-muted hover:text-text"
        }`}
      >
        <Zap className="h-3 w-3" strokeWidth={2} />
        Demo
        <span
          className={`ml-0.5 h-3 w-6 p-0.5 transition ${demoMode ? "bg-red/40" : "bg-white/10"}`}
        >
          <span
            className={`block h-2 w-2 bg-white transition-transform ${demoMode ? "translate-x-3" : "translate-x-0"}`}
          />
        </span>
      </button>

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
