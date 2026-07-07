"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { useIntel } from "@/store/intel";
import { playBreachPing } from "@/lib/sound";
import { clockString } from "@/lib/time";

/** Bridges store breach events → Sonner toasts (never overlapping, capped at 4)
 *  and the persistent Alert Log already holds them. Also plays the alert ping. */
export default function BreachToaster() {
  const lastBreach = useIntel((s) => s.lastBreach);
  const muted = useIntel((s) => s.muted);
  const toastsEnabled = useIntel((s) => s.toastsEnabled);

  useEffect(() => {
    if (!lastBreach) return;
    playBreachPing(muted);
    if (!toastsEnabled) return; // user stopped pop-ups
    toast.custom(
      () => (
        <div className="flex w-[340px] items-start gap-3 border border-red bg-panel p-3 shadow-glow">
          <AlertTriangle className="mt-0.5 h-4 w-4 animate-pulse text-red-bright" />
          <div className="min-w-0">
            <div className="mono text-[11px] font-semibold uppercase tracking-[0.14em] text-red-bright">
              ⚠ Geofence Breach
            </div>
            <div className="mono mt-0.5 text-sm font-bold tracking-wide text-text">
              {lastBreach.city.toUpperCase()}
            </div>
            <div className="mono mt-0.5 text-[10px] text-muted">
              {clockString(new Date(lastBreach.at))} · in-zone jurisdiction hit
            </div>
          </div>
        </div>
      ),
      { duration: 5000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastBreach?.seq]);

  return null;
}
