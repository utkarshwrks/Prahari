"use client";

import { Bitcoin } from "lucide-react";
import { toast } from "sonner";
import { useIntel } from "@/store/intel";
import { walletClusters } from "@/lib/analytics";
import TacticalPanel from "../../ui/TacticalPanel";

function copyWallet(w: string) {
  navigator.clipboard?.writeText(w).then(
    () =>
      toast.custom(() => (
        <div className="mono border border-red bg-panel px-3 py-2 text-[12px] text-text shadow-glow">
          ✓ Wallet copied
        </div>
      )),
    () => {}
  );
}

const truncate = (w: string) => (w.length > 16 ? `${w.slice(0, 9)}…${w.slice(-4)}` : w);

export default function WalletTracker() {
  const intercepts = useIntel((s) => s.intercepts);
  const wallets = walletClusters(intercepts);
  const max = Math.max(1, ...wallets.map((w) => w.count));

  return (
    <TacticalPanel title="Wallet Cluster Tracker" live>
      <div className="space-y-1.5 p-3">
        <div className="mono mb-1 text-[10px] leading-snug text-muted-2">
          Recurring addresses link otherwise-separate sellers.
        </div>
        {wallets.length === 0 && (
          <div className="mono text-[10px] text-muted-2">— no reuse detected yet —</div>
        )}
        {wallets.map((w) => {
          const isCluster = w.count > 1;
          return (
            <button
              key={w.wallet}
              onClick={() => copyWallet(w.wallet)}
              title="Click to copy address"
              className="relative w-full overflow-hidden border border-border bg-panel-2/40 px-2.5 py-1.5 text-left transition hover:border-red/40"
            >
              <div
                className="absolute left-0 top-0 h-full bg-red/10"
                style={{ width: `${(w.count / max) * 100}%` }}
              />
              <div className="relative flex items-center justify-between gap-2">
                <span className="mono flex items-center gap-1.5 truncate text-[11px]">
                  <Bitcoin className={`h-3 w-3 ${isCluster ? "text-red-bright" : "text-muted"}`} />
                  <span className={isCluster ? "text-text" : "text-muted"}>
                    {truncate(w.wallet)}
                  </span>
                </span>
                <span
                  className={`mono shrink-0 border px-1.5 text-[9px] tabular-nums ${
                    isCluster ? "border-red/50 text-red-bright" : "border-border text-muted-2"
                  }`}
                >
                  ×{w.count}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </TacticalPanel>
  );
}
