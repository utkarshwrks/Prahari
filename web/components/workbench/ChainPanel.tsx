"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Coins, Search, ShieldAlert } from "lucide-react";
import { api, type ClusterResult, type TraceResult } from "@/lib/api";
import Panel from "../ui/Panel";

/**
 * Blockchain flow — wallet clustering to real-world off-ramps.
 *
 * Shows the labelled clusters (with their exchange / mixer trails) and lets an
 * analyst trace ANY real BTC address live: common-input clustering on the
 * actual chain, ending at a tagged exchange or a mixer. A mixer path is the
 * money-laundering signal, and it drops the financial evidence for attribution.
 */
export default function ChainPanel() {
  const [c, setC] = useState<ClusterResult | null>(null);
  const [addr, setAddr] = useState("1dice8EMZmqKvrGE4Qc9bUFf9PX3xaYDp");
  const [trace, setTrace] = useState<TraceResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const d = await api.clusters();
      if ("ok" in d && d.ok) setC(d as ClusterResult);
    })();
  }, []);

  async function run() {
    setBusy(true); setTrace(null);
    const d = await api.trace(addr);
    if ("ok" in d) setTrace(d as TraceResult);
    setBusy(false);
  }

  const riskColor = (r: string) =>
    r === "laundering" ? "var(--c-high)" : r === "exchange" ? "var(--warn)" : "var(--muted)";

  return (
    <Panel title="Blockchain flow" marked className="h-full" bodyClassName="min-h-0">
      <div className="slim h-full overflow-y-auto p-3">
        <p className="mono text-[10px] leading-relaxed text-[var(--muted)]">
          Addresses co-spent in one transaction share a controller. Union-find
          clusters them, then traces the money to a tagged exchange or mixer.
        </p>

        {/* Labelled clusters */}
        {c && (
          <div className="mt-3 space-y-1.5">
            {c.clusters.map((cl) => (
              <div key={cl.cluster_id} className="border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="mono flex items-center gap-1.5 text-[11px] text-[var(--text)]">
                    <Coins className="h-3 w-3 text-[var(--muted-2)]" />
                    {cl.addresses.length} addresses
                  </span>
                  <span className="chip" style={{ color: riskColor(cl.risk), borderColor: riskColor(cl.risk) }}>
                    {cl.risk}
                  </span>
                </div>
                {cl.reaches.map((rc) => (
                  <p key={rc.address} className="mono mt-1 flex items-center gap-1 text-[9px]"
                     style={{ color: riskColor(cl.risk) }}>
                    <ArrowRight className="h-2.5 w-2.5" /> {rc.label}
                    {rc.kind === "mixer" && <ShieldAlert className="h-2.5 w-2.5" />}
                  </p>
                ))}
              </div>
            ))}
            <p className="mono text-[9px] text-[var(--muted-2)]">
              {c.co_spent_edges} CO_SPENT_WITH edges feed the identity graph.
            </p>
          </div>
        )}

        {/* Live trace */}
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--muted-2)]" />
            <input
              value={addr} onChange={(e) => setAddr(e.target.value)}
              aria-label="BTC address to trace"
              className="mono w-full border border-[var(--border)] bg-[var(--surface-2)] py-1.5 pl-7 pr-2 text-[10px] text-[var(--text)] focus:border-[var(--accent-dim)] focus:outline-none"
            />
          </label>
          <button onClick={run} disabled={busy}
            className="mono mt-2 flex w-full items-center justify-center gap-1.5 border border-[var(--accent-dim)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] py-1.5 text-[9px] uppercase tracking-[0.16em] text-[var(--c-high)] transition hover:bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] disabled:opacity-50">
            {busy ? "Tracing live chain…" : "Trace on the real chain"}
          </button>

          {trace && (
            <div className="mono mt-2 space-y-0.5 text-[10px]">
              {trace.transactions ? (
                <>
                  <p className="text-[var(--muted)]">
                    {trace.source} · {trace.transactions} tx · {trace.multi_input_txs} multi-input
                  </p>
                  <p className="text-[var(--text)]">
                    {trace.clusters} clusters · {trace.co_spent_edges} co-spent edges
                  </p>
                  {trace.target_cluster && (
                    <p className="text-[var(--muted)]">
                      this address controls{" "}
                      <span className="text-[var(--c-high)]">
                        {trace.target_cluster.addresses.length}
                      </span>{" "}
                      addresses ({trace.target_cluster.risk})
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[var(--muted-2)]">{trace.detail}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
