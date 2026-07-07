"use client";

import { useIntel, ThreatLevel } from "@/store/intel";

const STYLE: Record<
  ThreatLevel,
  { ring: string; text: string; dot: string; glow: boolean }
> = {
  NOMINAL: {
    ring: "border-border-2 bg-panel-2",
    text: "text-muted",
    dot: "bg-muted-2",
    glow: false,
  },
  ELEVATED: {
    ring: "border-red-deep/60 bg-red-deep/10",
    text: "text-red-deep",
    dot: "bg-red-deep",
    glow: false,
  },
  CRITICAL: {
    ring: "border-red bg-red/10",
    text: "text-red-bright",
    dot: "bg-red-bright",
    glow: true,
  },
};

export default function ThreatHUD() {
  const level = useIntel((s) => s.threatLevel);
  const s = STYLE[level];
  return (
    <div
      data-tour="threat"
      className={`flex items-center gap-2.5 border px-3.5 py-1.5 ${s.ring} ${
        s.glow ? "animate-pulseGlow" : ""
      }`}
    >
      <span className="relative flex h-2 w-2">
        {level === "CRITICAL" && (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${s.dot} opacity-70`} />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${s.dot}`} />
      </span>
      <span className="mono text-[10px] uppercase tracking-[0.2em] text-muted-2">
        Threat Level
      </span>
      <span className={`mono text-sm font-bold uppercase tracking-[0.18em] ${s.text}`}>
        {level}
      </span>
    </div>
  );
}
