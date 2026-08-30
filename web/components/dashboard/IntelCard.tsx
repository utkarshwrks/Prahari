"use client";

import { motion } from "framer-motion";
import { MapPin, ChevronRight, Radio } from "lucide-react";
import { Intercept } from "@/lib/mockIntel";
import { relativeTime } from "@/lib/time";
import SourceBadge from "./SourceBadge";

const SEV_BAR: Record<Intercept["severity"], string> = {
  high: "bg-red-bright",
  medium: "bg-red-deep",
  low: "bg-muted-2",
};
const SEV_TEXT: Record<Intercept["severity"], string> = {
  high: "text-red-bright",
  medium: "text-red-deep",
  low: "text-muted-2",
};

/** Compact summary card. Full entities + raw text open in a modal on click. */
export default function IntelCard({
  intercept,
  now,
  onClick,
}: {
  intercept: Intercept;
  now: number;
  onClick?: () => void;
}) {
  const e = intercept.entities;
  const entityCount =
    e.locations.length + e.contraband.length + e.wallets.length + e.handles.length;
  const primaryCity = e.locations[0];
  // short, clean one-liner (strip the [OSINT] prefix for display)
  const snippet = intercept.rawText.replace(/^\[OSINT\]\s*/, "");

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      onClick={onClick}
      className="group relative w-full overflow-hidden border border-border bg-panel-2/40 pl-2.5 text-left transition hover:border-red/40 hover:bg-panel-2/70"
    >
      <span className={`absolute left-0 top-0 h-full w-[3px] ${SEV_BAR[intercept.severity]}`} />
      <div className="px-2.5 py-2">
        {/* top row */}
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {intercept.live && intercept.channel ? (
              <span className="mono flex items-center gap-1 border border-red/40 bg-red/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-red-bright">
                <Radio className="h-2.5 w-2.5" /> {intercept.channel}
              </span>
            ) : (
              <SourceBadge source={intercept.source} />
            )}
            <span className={`mono text-[8px] uppercase tracking-wider ${SEV_TEXT[intercept.severity]}`}>
              {intercept.severity}
            </span>
          </div>
          <span className="mono shrink-0 text-[9px] text-muted-2">
            {relativeTime(intercept.timestamp, now)}
          </span>
        </div>

        {/* one-line summary */}
        <p className="line-clamp-2 text-[12px] leading-snug text-text/90">{snippet}</p>

        {/* footer: primary city + entity count + chevron */}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {primaryCity && (
              <span className="mono flex items-center gap-0.5 text-[10px] text-red-bright">
                <MapPin className="h-3 w-3" />
                {primaryCity}
              </span>
            )}
            {entityCount > 0 && (
              <span className="mono text-[9px] text-muted-2">
                {entityCount} entit{entityCount === 1 ? "y" : "ies"}
              </span>
            )}
          </div>
          <span className="mono flex shrink-0 items-center gap-0.5 text-[9px] text-muted-2 opacity-0 transition group-hover:opacity-100">
            details <ChevronRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </motion.button>
  );
}
