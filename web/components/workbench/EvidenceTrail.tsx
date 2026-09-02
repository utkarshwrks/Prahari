"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Layers, Sigma } from "lucide-react";
import { api, type PairScore } from "@/lib/api";
import Panel from "../ui/Panel";
import { confidenceColor } from "../ui/Confidence";
import { SIGNAL_LABEL, signalVar, type SignalRoot } from "@/lib/signals";

/**
 * The evidence trail. This panel is the argument the project is built on.
 *
 * It shows how correlated signals become a defensible number instead of a
 * saturated one: each signal's likelihood ratio, the root-cause collapse that
 * stops one fact being counted twice, and the reliability exponent that says a
 * signing key is not a writing style.
 *
 * The arithmetic is DISPLAYED, not asserted. A score whose trail cannot
 * recompute it is not evidence.
 */

// Labels come from lib/signals.ts, the single source of truth for signal-root
// naming and colour, so the trail and the graph legend cannot disagree.
const ROOT_LABEL: Record<string, string> = SIGNAL_LABEL;

/**
 * The bar colour for a root (DEC-055).
 *
 * Was `linear-gradient(var(--accent-dim), var(--accent))` for EVERY root: all
 * six drawn in one colour, and that colour skin-dependent. Bar length was the
 * only encoding, and the single thing colour did carry moved when the skin was
 * redrawn. `--sig-*` is declared once in :root and no skin may override it.
 */
function rootColor(root: string): string {
  const v = signalVar(root as SignalRoot);
  // Unknown roots keep the neutral token rather than borrowing another root's
  // colour, which would assert a kinship that does not exist.
  return SIGNAL_LABEL[root as SignalRoot] ? `var(${v})` : "var(--muted-2)";
}

export default function EvidenceTrail({ pairId }: { pairId: string | null }) {
  const [d, setD] = useState<PairScore | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setD(null); setErr(null);
    (async () => {
      const r = pairId ? await api.pair(pairId) : await api.example();
      if (!alive) return;
      if ("engine" in r && r.engine === "offline") setErr(r.detail ?? "Engine offline.");
      else if ("ok" in r && r.ok) setD(r as PairScore);
      else setErr((r as PairScore).detail ?? "No score for this pair.");
    })();
    return () => { alive = false; };
  }, [pairId]);

  const roots = d ? Object.entries(d.roots_used) : [];
  const maxBar = Math.max(1, ...roots.map(([, v]) => v.lr_pow_r));

  return (
    <Panel
      title="Evidence trail"
      marked
      className="h-full"
      bodyClassName="min-h-0"
      right={
        d && (
          <span className="mono text-[9px] text-[var(--muted-2)]">
            {pairId ? "selected pair" : "worked example"}
          </span>
        )
      }
    >
      <div className="slim h-full overflow-y-auto p-3">
        {err && <p className="mono text-[10px] text-[var(--muted)]">{err}</p>}
        {!d && !err && <p className="mono text-[10px] text-[var(--muted-2)]">FUSING EVIDENCE…</p>}

        {d && (
          <div className="space-y-3">
            {/* The comparison that is the whole argument. */}
            <div className="grid grid-cols-2 gap-2">
              <div className="border border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--accent)_9%,transparent)] p-2.5">
                <p className="mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
                  PRAHARI
                </p>
                <p className="mono tnum mt-1 text-2xl font-bold" style={{ color: confidenceColor(d.p_raw) }}>
                  {d.p_raw.toFixed(3)}
                </p>
                <p className="mono mt-0.5 text-[9px] text-[var(--muted-2)]">
                  root-collapsed, reliability-dampened
                </p>
              </div>
              <div className="border border-[var(--border)] bg-[var(--surface-2)] p-2.5">
                <p className="mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
                  Naive stacking
                </p>
                <p className="mono tnum mt-1 text-2xl font-bold text-[var(--muted)]">
                  {d.naive_stack.toFixed(3)}
                </p>
                <p className="mono mt-0.5 text-[9px] text-[var(--muted-2)]">
                  assumes independence
                </p>
              </div>
            </div>

            <p className="mono border-l-2 border-[var(--accent-dim)] pl-2 text-[10px] leading-relaxed text-[var(--muted)]">
              Treating correlated evidence as independent saturates the score. The gap of{" "}
              <span className="text-[var(--c-high)]">
                {(d.naive_stack - d.p_raw).toFixed(3)}
              </span>{" "}
              is the difference between a number that survives cross-examination
              and one that does not.
            </p>

            {/* Arithmetic, shown. */}
            <div>
              <h4 className="mono mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                <Sigma className="h-3 w-3" /> Likelihood ratios by root
              </h4>
              {/* One block per root: the numbers and the bar together, so there
                  is no separate bar list duplicating the table below it. */}
              <div className="mono space-y-2.5">
                <div className="flex items-center gap-2 text-[8.5px] uppercase tracking-wider text-[var(--muted-2)]">
                  <span className="flex-1">Root</span>
                  <span className="tnum w-8 text-right">s</span>
                  <span className="tnum w-12 text-right">LR</span>
                  <span className="tnum w-6 text-right">r</span>
                  <span className="tnum w-12 text-right">LR^r</span>
                </div>
                {roots.map(([root, v]) => (
                  <div key={root} className="space-y-1 border-t border-[var(--border)] pt-1.5">
                    <div className="flex items-center gap-2 text-[10px]">
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: rootColor(root) }}
                      />
                      <span className="flex-1 truncate text-[var(--text)]">{ROOT_LABEL[root] ?? root}</span>
                      <span className="tnum w-8 text-right text-[var(--muted)]">{v.s.toFixed(2)}</span>
                      <span className="tnum w-12 text-right text-[var(--muted)]">{v.lr.toFixed(3)}</span>
                      <span className="tnum w-6 text-right text-[var(--muted-2)]">{v.r}</span>
                      <span className="tnum w-12 text-right font-bold text-[var(--c-high)]">{v.lr_pow_r.toFixed(3)}</span>
                    </div>
                    <span className="bar block">
                      <span
                        style={{
                          width: `${(v.lr_pow_r / maxBar) * 100}%`,
                          background: `linear-gradient(90deg, color-mix(in srgb, ${rootColor(root)} 45%, transparent), ${rootColor(root)})`,
                        }}
                      />
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <dl className="mono space-y-0.5 border-t border-[var(--border)] pt-2 text-[10px]">
              {[
                ["LR total", d.trail.lr_total.toFixed(4)],
                ["Prior odds", d.trail.prior_label],
                ["Posterior odds", d.trail.posterior_odds.toFixed(4)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-[var(--muted)]">{k}</dt>
                  <dd className="tnum text-[var(--text)]">{v}</dd>
                </div>
              ))}
              {d.reproduced_from_trail !== undefined && (
                <div className="flex justify-between">
                  <dt className="text-[var(--muted)]">Trail recomputes score</dt>
                  <dd className={d.reproduced_from_trail === d.p_raw ? "text-[var(--ok)]" : "text-[var(--c-high)]"}>
                    {d.reproduced_from_trail === d.p_raw ? "exact" : "MISMATCH"}
                  </dd>
                </div>
              )}
            </dl>

            {Object.keys(d.roots_collapsed).length > 0 && (
              <div>
                <h4 className="mono mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  <Layers className="h-3 w-3" /> Collapsed by root cause
                </h4>
                {Object.entries(d.roots_collapsed).map(([root, items]) => (
                  <p key={root} className="mono text-[9px] text-[var(--muted-2)]">
                    <span className="text-[var(--muted)]">{ROOT_LABEL[root] ?? root}:</span>{" "}
                    {items.join(" · ")} — discarded, same underlying fact
                  </p>
                ))}
              </div>
            )}

            {(d.negatives.length > 0 || d.trail.caps.length > 0) && (
              <div className="border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] p-2">
                <p className="mono flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--c-high)]">
                  <AlertTriangle className="h-3 w-3" /> Evidence against
                </p>
                {d.negatives.map((n) => (
                  <p key={n.name} className="mono mt-1 text-[9px] text-[var(--text)]">
                    {n.name} <span className="text-[var(--muted-2)]">({n.root})</span>
                  </p>
                ))}
                {d.trail.caps.map((c) => (
                  <p key={c} className="mono mt-1 text-[9px] text-[var(--c-high)]">cap applied: {c}</p>
                ))}
              </div>
            )}

            {d.trail.roots_absent.length > 0 && (
              <p className="mono text-[9px] text-[var(--muted-2)]">
                No evidence under: {d.trail.roots_absent.join(", ")}
              </p>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
