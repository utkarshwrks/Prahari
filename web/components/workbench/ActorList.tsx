"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Search, Users } from "lucide-react";
import { api, type ActorRow } from "@/lib/api";
import { confidenceColor } from "../ui/Confidence";
import Panel from "../ui/Panel";

// Bands so a list of 120 actors reads as structure, not a wall of identical
// bars. Rows arrive already sorted by confidence, so bucketing preserves order.
const BANDS = [
  { id: "high", label: "Strong case", min: 0.9 },
  { id: "med", label: "Worth a look", min: 0.75 },
  { id: "low", label: "Weak / unresolved", min: -1 },
] as const;

function bandOf(c: number | null): string {
  if (c == null) return "low";
  if (c >= 0.9) return "high";
  if (c >= 0.75) return "med";
  return "low";
}

/**
 * The actor list — the entry point to the whole workbench.
 *
 * Sorted by attribution confidence, because an analyst's first question is
 * "which of these do I actually have a case against". A list sorted by
 * recency or name would bury the answer.
 */
export default function ActorList({
  selected, onSelect,
}: { selected: string | null; onSelect: (id: string) => void }) {
  const [rows, setRows] = useState<ActorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [minConf, setMinConf] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => {
    const g: Record<string, ActorRow[]> = { high: [], med: [], low: [] };
    for (const r of rows) g[bandOf(r.attribution_confidence)].push(r);
    return g;
  }, [rows]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      const d = await api.actors(q, minConf);
      if (!alive) return;
      if ("engine" in d && d.engine === "offline") {
        setError(d.detail ?? "Engine offline.");
      } else if ("actors" in d) {
        setRows(d.actors);
        setTotal(d.total);
        setError(null);
        // Select the strongest case by default so the workbench opens on
        // something worth looking at rather than an empty pane.
        if (!selected && d.actors.length) onSelect(d.actors[0].actor_id);
      }
      setLoading(false);
    }, 220);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, minConf]);

  const thresholds = useMemo(
    () => [
      { v: 0, label: "All" },
      { v: 0.4, label: "≥ 0.40" },
      { v: 0.75, label: "≥ 0.75" },
      { v: 0.9, label: "≥ 0.90" },
    ], []);

  return (
    <Panel
      title="Actors"
      marked
      right={
        <span className="mono tnum text-[10px] text-[var(--muted-2)]">
          {total} resolved
        </span>
      }
      className="h-full"
      bodyClassName="flex flex-col min-h-0"
    >
      <div className="shrink-0 space-y-2 px-3 py-2.5">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-2)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="handle, PGP, wallet, actor id"
            aria-label="Search actors by handle or identifier"
            className="mono w-full border border-[var(--border)] bg-[var(--surface-2)] py-1.5 pl-8 pr-2 text-[11px] text-[var(--text)] placeholder:text-[var(--muted-2)] focus:border-[var(--accent-dim)] focus:outline-none"
          />
        </label>

        <div role="group" aria-label="Filter by attribution confidence" className="flex gap-1">
          {thresholds.map((t) => (
            <button
              key={t.v}
              onClick={() => setMinConf(t.v)}
              aria-pressed={minConf === t.v}
              className={`mono flex-1 border px-1 py-1 text-[9px] uppercase tracking-wider transition ${
                minConf === t.v
                  ? "border-[var(--accent-dim)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--c-high)]"
                  : "border-[var(--border)] text-[var(--muted-2)] hover:text-[var(--muted)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="slim min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {loading && rows.length === 0 && (
          <p className="mono px-1 py-3 text-[10px] text-[var(--muted-2)]">RESOLVING ACTORS…</p>
        )}
        {error && (
          <p className="mono px-1 py-3 text-[10px] text-[var(--muted)]">{error}</p>
        )}
        {!loading && !error && rows.length === 0 && (
          <p className="mono px-1 py-3 text-[10px] text-[var(--muted-2)]">
            No actor matches that filter.
          </p>
        )}

        <div className="space-y-2">
          {BANDS.map((band) => {
            const items = grouped[band.id];
            if (!items || items.length === 0) return null;
            const isCollapsed = collapsed[band.id];
            const dot = band.id === "high" ? "var(--c-high)" : band.id === "med" ? "var(--c-mid)" : "var(--c-low)";
            return (
              <section key={band.id}>
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [band.id]: !c[band.id] }))}
                  className="mono sticky top-0 z-[1] flex w-full items-center gap-1.5 bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] px-1 py-1.5 text-left text-[9px] uppercase tracking-[0.14em] text-[var(--muted-2)] backdrop-blur"
                >
                  <ChevronRight className={`h-3 w-3 transition-transform ${isCollapsed ? "" : "rotate-90"}`} />
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
                  {band.label}
                  <span className="tnum ml-auto text-[var(--muted-2)]">{items.length}</span>
                </button>

                {!isCollapsed && (
                  <ul className="mt-0.5 space-y-0.5">
                    {items.map((a) => {
                      const active = a.actor_id === selected;
                      const color = confidenceColor(a.attribution_confidence);
                      return (
                        <li key={a.actor_id}>
                          <button
                            onClick={() => onSelect(a.actor_id)}
                            aria-current={active ? "true" : undefined}
                            className={`group flex w-full items-center gap-2.5 rounded-[var(--radius)] border px-2.5 py-2 text-left transition ${
                              active
                                ? "border-[var(--accent-dim)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
                                : "border-transparent hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]"
                            }`}
                          >
                            {/* confidence as a single dot, not a repeated bar */}
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ background: color, boxShadow: active ? `0 0 7px ${color}` : "none" }}
                              title={a.attribution_confidence == null ? "unscored" : `confidence ${a.attribution_confidence.toFixed(2)}`}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline justify-between gap-2">
                                <span className="mono truncate text-[12px] text-[var(--text)]">{a.label}</span>
                                <span className="mono tnum shrink-0 text-[10px]" style={{ color }}>
                                  {a.attribution_confidence == null ? "—" : a.attribution_confidence.toFixed(2)}
                                </span>
                              </span>
                              <span className="mono mt-0.5 flex items-center gap-1 text-[9px] text-[var(--muted-2)]">
                                <Users className="h-2.5 w-2.5" />
                                {a.personas}p · {a.markets.slice(0, 2).join(", ")}
                                {a.markets.length > 2 ? ` +${a.markets.length - 2}` : ""}
                                {a.flags.length > 0 && (
                                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--accent)]" title={a.flags.join(" · ")} />
                                )}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
