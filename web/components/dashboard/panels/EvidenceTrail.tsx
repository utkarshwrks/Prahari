"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Layers, Sigma } from "lucide-react";
import TacticalPanel from "../../ui/TacticalPanel";

/**
 * The evidence trail. This panel IS the pitch.
 *
 * It shows how five correlated signals become 0.84 rather than 0.999: each
 * signal's likelihood ratio, the root-cause collapse that stops one fact being
 * counted twice, and the reliability exponent that says a PGP key is not a
 * writing style. Every number here is recomputable from what is displayed --
 * that is the claim, so the panel has to show the arithmetic, not just assert
 * the answer.
 */

interface RootRow {
  signal: string;
  s: number;
  lr: number;
  r: number;
  lr_pow_r: number;
}

interface Trail {
  prior_odds: number;
  prior_label: string;
  lr_total: number;
  posterior_odds: number;
  caps: string[];
  dropped_roots: string[];
  roots_absent: string[];
}

interface PairScore {
  ok: boolean;
  pair_id: string;
  p_raw: number;
  p_calibrated: number | null;
  naive_stack: number;
  cap_applied: number | null;
  roots_used: Record<string, RootRow>;
  roots_collapsed: Record<string, string[]>;
  negatives: { name: string; root: string }[];
  trail: Trail;
  reproduced_from_trail?: number;
  detail?: string;
}

const ROOT_LABEL: Record<string, string> = {
  identity_key: "Identity key",
  financial: "Financial",
  infra: "Infrastructure",
  linguistic: "Linguistic",
  temporal: "Temporal",
  social: "Social",
};

export default function EvidenceTrail({ pairId }: { pairId?: string }) {
  const [data, setData] = useState<PairScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const path = pairId
      ? `/api/engine/fusion/pair/${encodeURIComponent(pairId)}`
      : "/api/engine/fusion/example";
    setLoading(true);
    fetch(path)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d?.engine === "offline") setError(d.detail ?? "Engine offline.");
        else if (!d?.ok) setError(d?.detail ?? "No score for this pair.");
        else setData(d);
      })
      .catch(() => alive && setError("Engine unreachable."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [pairId]);

  const roots = data ? Object.entries(data.roots_used) : [];
  const maxBar = Math.max(1, ...roots.map(([, v]) => v.lr_pow_r));

  return (
    <TacticalPanel title="Evidence Trail" tourId="evidence">
      <div className="slim-scroll h-full overflow-y-auto p-3">
        {loading && (
          <div className="mono text-[10px] text-muted-2">COMPUTING FUSION…</div>
        )}

        {error && (
          <div className="mono border border-border-2 bg-panel-2/50 p-2 text-[10px] text-muted">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* The headline comparison. */}
            <div className="grid grid-cols-2 gap-2">
              <div className="border border-red/50 bg-red/10 p-2.5">
                <div className="mono text-[9px] uppercase tracking-[0.18em] text-muted">
                  PRAHARI
                </div>
                <div className="mono mt-1 text-2xl font-bold tabular-nums text-red-bright">
                  {data.p_raw.toFixed(3)}
                </div>
                <div className="mono mt-0.5 text-[9px] text-muted-2">
                  root-collapsed, reliability-dampened
                </div>
              </div>
              <div className="border border-border-2 bg-panel-2/40 p-2.5">
                <div className="mono text-[9px] uppercase tracking-[0.18em] text-muted">
                  Naive stacking
                </div>
                <div className="mono mt-1 text-2xl font-bold tabular-nums text-muted">
                  {data.naive_stack.toFixed(3)}
                </div>
                <div className="mono mt-0.5 text-[9px] text-muted-2">
                  assumes independence
                </div>
              </div>
            </div>

            <div className="mono mt-2 border-l-2 border-red/60 bg-panel-2/30 px-2 py-1.5 text-[10px] leading-relaxed text-muted">
              Naive stacking treats correlated evidence as independent and
              saturates. The gap of{" "}
              <span className="text-red-bright">
                {(data.naive_stack - data.p_raw).toFixed(3)}
              </span>{" "}
              is the difference between a number that survives
              cross-examination and one that does not.
            </div>

            {/* The arithmetic, shown rather than asserted. */}
            <div className="mono mt-3 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted">
              <Sigma className="h-3 w-3" />
              Likelihood ratios by root
            </div>
            <table className="mono mt-1.5 w-full text-[10px]">
              <thead>
                <tr className="text-muted-2">
                  <th className="py-1 text-left font-normal">Root</th>
                  <th className="py-1 text-right font-normal">s</th>
                  <th className="py-1 text-right font-normal">LR</th>
                  <th className="py-1 text-right font-normal">r</th>
                  <th className="py-1 text-right font-normal">LR^r</th>
                </tr>
              </thead>
              <tbody>
                {roots.map(([root, v]) => (
                  <tr key={root} className="border-t border-border/50">
                    <td className="py-1 text-text">{ROOT_LABEL[root] ?? root}</td>
                    <td className="py-1 text-right tabular-nums text-muted">
                      {v.s.toFixed(2)}
                    </td>
                    <td className="py-1 text-right tabular-nums text-muted">
                      {v.lr.toFixed(3)}
                    </td>
                    <td className="py-1 text-right tabular-nums text-muted-2">{v.r}</td>
                    <td className="py-1 text-right tabular-nums text-red-bright">
                      {v.lr_pow_r.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Contribution bars: which root actually moved the number. */}
            <div className="mt-2 space-y-1">
              {roots.map(([root, v]) => (
                <div key={root} className="flex items-center gap-2">
                  <span className="mono w-24 shrink-0 truncate text-[9px] text-muted-2">
                    {ROOT_LABEL[root] ?? root}
                  </span>
                  <span className="relative h-2 flex-1 bg-panel-2">
                    <span
                      className="absolute left-0 top-0 h-full bg-red/50"
                      style={{ width: `${(v.lr_pow_r / maxBar) * 100}%` }}
                    />
                  </span>
                </div>
              ))}
            </div>

            <div className="mono mt-2 space-y-0.5 border-t border-border pt-2 text-[10px] text-muted">
              <div className="flex justify-between">
                <span>LR total</span>
                <span className="tabular-nums text-text">
                  {data.trail.lr_total.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Prior odds</span>
                <span className="tabular-nums text-text">{data.trail.prior_label}</span>
              </div>
              <div className="flex justify-between">
                <span>Posterior odds</span>
                <span className="tabular-nums text-text">
                  {data.trail.posterior_odds.toFixed(4)}
                </span>
              </div>
              {data.reproduced_from_trail !== undefined && (
                <div className="flex justify-between">
                  <span>Trail recomputes score</span>
                  <span
                    className={
                      data.reproduced_from_trail === data.p_raw
                        ? "text-red-bright"
                        : "text-muted-2"
                    }
                  >
                    {data.reproduced_from_trail === data.p_raw ? "exact" : "MISMATCH"}
                  </span>
                </div>
              )}
            </div>

            {/* Collapsed signals: the most contestable step, so it is itemised. */}
            {Object.keys(data.roots_collapsed).length > 0 && (
              <div className="mt-3">
                <div className="mono flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted">
                  <Layers className="h-3 w-3" />
                  Collapsed by root cause
                </div>
                {Object.entries(data.roots_collapsed).map(([root, items]) => (
                  <div key={root} className="mono mt-1 text-[9px] text-muted-2">
                    <span className="text-muted">{ROOT_LABEL[root] ?? root}:</span>{" "}
                    {items.join(" · ")} — discarded, same underlying fact
                  </div>
                ))}
              </div>
            )}

            {/* Negatives and caps. */}
            {(data.negatives.length > 0 || data.trail.caps.length > 0) && (
              <div className="mt-3 border border-red/40 bg-red/10 p-2">
                <div className="mono flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-red-bright">
                  <AlertTriangle className="h-3 w-3" />
                  Evidence against
                </div>
                {data.negatives.map((n) => (
                  <div key={n.name} className="mono mt-1 text-[9px] text-text">
                    {n.name} <span className="text-muted-2">({n.root})</span>
                  </div>
                ))}
                {data.trail.caps.map((c) => (
                  <div key={c} className="mono mt-1 text-[9px] text-red-bright">
                    cap applied: {c}
                  </div>
                ))}
                {data.trail.dropped_roots.length > 0 && (
                  <div className="mono mt-1 text-[9px] text-muted">
                    roots dropped entirely: {data.trail.dropped_roots.join(", ")}
                  </div>
                )}
              </div>
            )}

            {data.trail.roots_absent.length > 0 && (
              <div className="mono mt-2 text-[9px] text-muted-2">
                No evidence under: {data.trail.roots_absent.join(", ")}
              </div>
            )}
          </>
        )}
      </div>
    </TacticalPanel>
  );
}
