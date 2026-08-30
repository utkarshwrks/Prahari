"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle, Download, Fingerprint, Globe, KeyRound, Mail, Server, Wallet,
} from "lucide-react";
import { api, type ActorProfile as Profile, type Timeline } from "@/lib/api";
import Confidence from "../ui/Confidence";
import Panel from "../ui/Panel";
import ActorTimeline from "./ActorTimeline";
import ActorGraphPanel from "./ActorGraphPanel";

const IDENT_ICON: Record<string, typeof KeyRound> = {
  pgp: KeyRound, wallet: Wallet, email: Mail, onion: Globe,
};

const short = (v: string) => (v.length > 26 ? `${v.slice(0, 14)}…${v.slice(-8)}` : v);

export default function ActorProfileView({
  actorId, onOpenPair,
}: { actorId: string | null; onOpenPair: (pairId: string) => void }) {
  const [p, setP] = useState<Profile | null>(null);
  const [tl, setTl] = useState<Timeline | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!actorId) return;
    let alive = true;
    setP(null); setTl(null); setErr(null);
    (async () => {
      const d = await api.actor(actorId);
      if (!alive) return;
      if ("engine" in d && d.engine === "offline") setErr(d.detail ?? "Engine offline.");
      else if ("ok" in d && d.ok) setP(d as Profile);
      else setErr((d as Profile).detail ?? "Unknown actor.");
      const t = await api.timeline(actorId);
      if (alive && "ok" in t && t.ok) setTl(t as Timeline);
    })();
    return () => { alive = false; };
  }, [actorId]);

  if (!actorId) {
    return (
      <Panel title="Actor profile" className="h-full">
        <p className="mono p-4 text-[10px] text-[var(--muted-2)]">
          Select an actor to open its profile.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Actor profile"
      marked
      className="h-full"
      bodyClassName="min-h-0"
      right={
        p && (
          <span className="flex items-center gap-1">
            {(["json", "csv"] as const).map((fmt) => (
              <a
                key={fmt}
                href={`/api/engine/export/actor/${encodeURIComponent(p.actor_id)}.${fmt}`}
                className="mono flex items-center gap-1 border border-[var(--border-2)] px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)]"
              >
                <Download className="h-2.5 w-2.5" />
                {fmt}
              </a>
            ))}
          </span>
        )
      }
    >
      <div className="slim h-full overflow-y-auto p-3">
        {err && <p className="mono text-[10px] text-[var(--muted)]">{err}</p>}
        {!p && !err && <p className="mono text-[10px] text-[var(--muted-2)]">LOADING PROFILE…</p>}

        {p && (
          <div className="space-y-4">
            {/* The graph is the anchor: the actor and its strongest ties, in 3D. */}
            <ActorGraphPanel profile={p} onOpenPair={onOpenPair} />

            {/* Headline: who, and how sure. */}
            <header className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="display truncate text-xl font-bold text-[var(--text)]">
                  {p.label}
                </h3>
                <p className="mono mt-0.5 text-[10px] text-[var(--muted-2)]">
                  {p.actor_id} · {p.personas.length} persona
                  {p.personas.length === 1 ? "" : "s"} · {p.post_count} posts
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="mono mb-1 text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
                  Attribution confidence
                </p>
                <Confidence value={p.attribution_confidence} size="lg" />
              </div>
            </header>

            <p className="mono border-l-2 border-[var(--border-2)] pl-2 text-[10px] leading-relaxed text-[var(--muted)]">
              {p.confidence_basis}
            </p>

            {p.flags.length > 0 && (
              <div className="flex items-start gap-2 border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] p-2">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[var(--c-high)]" />
                <div>
                  <p className="mono text-[10px] uppercase tracking-wider text-[var(--c-high)]">
                    Counter-deception flags
                  </p>
                  <p className="mono mt-0.5 text-[9px] text-[var(--muted)]">
                    {p.flags.join(" · ")} — evidence that argues against this linkage,
                    applied as a cap rather than a subtraction.
                  </p>
                </div>
              </div>
            )}

            {/* Personas */}
            <section>
              <h4 className="mono mb-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                Personas
              </h4>
              <ul className="space-y-1">
                {p.personas.map((s) => (
                  <li key={s.id} className="border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="mono truncate text-[11px] text-[var(--text)]">
                        {s.handle}
                        <span className="text-[var(--muted-2)]"> @{s.market}</span>
                      </span>
                      <span className="mono tnum shrink-0 text-[9px] text-[var(--muted-2)]">
                        {s.post_count} posts
                      </span>
                    </div>
                    <div className="mono mt-0.5 flex flex-wrap items-center gap-1.5 text-[9px] text-[var(--muted-2)]">
                      <span>{s.first_seen?.slice(0, 10)} → {s.last_seen?.slice(0, 10)}</span>
                      {s.role !== "normal" && <span className="chip chip-accent">{s.role}</span>}
                      {s.categories.map((c) => <span key={c} className="chip">{c}</span>)}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Identifiers — shared ones are the strongest evidence, so marked. */}
            <section>
              <h4 className="mono mb-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                Identifiers
              </h4>
              {p.identifiers.length === 0 ? (
                <p className="mono text-[9px] text-[var(--muted-2)]">
                  None recovered. This actor is held together by style and timing alone.
                </p>
              ) : (
                <ul className="space-y-1">
                  {p.identifiers.map((i) => {
                    const Icon = IDENT_ICON[i.kind] ?? Fingerprint;
                    return (
                      <li
                        key={`${i.kind}-${i.value}`}
                        className={`flex items-center gap-2 border px-2.5 py-1.5 ${
                          i.shared
                            ? "border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent)_7%,transparent)]"
                            : "border-[var(--border)] bg-[var(--surface-2)]"
                        }`}
                      >
                        <Icon className={`h-3 w-3 shrink-0 ${i.shared ? "text-[var(--c-high)]" : "text-[var(--muted-2)]"}`} />
                        <span className="mono min-w-0 flex-1 truncate text-[10px] text-[var(--text)]" title={i.value}>
                          {short(i.value)}
                        </span>
                        {i.shared && (
                          <span className="chip chip-accent shrink-0">
                            shared × {i.personas.length}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Infrastructure */}
            {p.infrastructure.length > 0 && (
              <section>
                <h4 className="mono mb-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  Infrastructure indicators
                </h4>
                {p.infrastructure.map((x) => (
                  <div key={x.clearnet_host} className="border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="mono flex items-center gap-1.5 text-[11px] text-[var(--text)]">
                        <Server className="h-3 w-3 text-[var(--muted-2)]" />
                        {x.clearnet_host}
                      </span>
                      <span className="mono tnum text-[11px] font-bold text-[var(--c-high)]">
                        {x.strength.toFixed(2)}
                      </span>
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {x.evidence.map((e) => (
                        <li key={e.rule} className="mono text-[9px] text-[var(--muted-2)]">
                          [{e.strength}] {e.detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            )}

            {/* Timeline — the PS's "queryable across a timeline" */}
            {tl && tl.buckets.length > 0 && <ActorTimeline timeline={tl} />}

            {/* Linkages */}
            <section>
              <h4 className="mono mb-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                Persona linkages
              </h4>
              {p.linkages.length === 0 ? (
                <p className="mono text-[9px] text-[var(--muted-2)]">
                  Single persona — nothing to link.
                </p>
              ) : (
                <ul className="space-y-1">
                  {p.linkages.map((l) => (
                    <li key={`${l.persona_a}|${l.persona_b}`}>
                      <button
                        onClick={() => onOpenPair(`${l.persona_a}|${l.persona_b}`)}
                        className="w-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-left transition hover:border-[var(--accent-dim)]"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="mono truncate text-[10px] text-[var(--text)]">
                            {l.persona_a} ↔ {l.persona_b}
                          </span>
                          <Confidence value={l.confidence} size="sm" showBar={false} />
                        </span>
                        <span className="mono mt-0.5 block text-[9px] text-[var(--muted-2)]">
                          {l.basis || "no positive evidence"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Provenance — the PS names last scan date and source explicitly. */}
            <footer className="mono grid grid-cols-2 gap-x-4 gap-y-1 border-t border-[var(--border)] pt-2 text-[9px] text-[var(--muted-2)]">
              <span>Markets</span><span className="text-[var(--muted)]">{p.markets.join(", ")}</span>
              <span>Categories</span><span className="text-[var(--muted)]">{p.categories.join(", ") || "—"}</span>
              <span>Active</span><span className="text-[var(--muted)]">{p.first_seen?.slice(0, 10)} → {p.last_seen?.slice(0, 10)}</span>
              <span>Last scan</span><span className="text-[var(--muted)]">{p.last_scan?.replace("T", " ").slice(0, 19)}</span>
              <span>Source</span><span className="text-[var(--muted)]">{p.sources.join(", ")}</span>
            </footer>
          </div>
        )}
      </div>
    </Panel>
  );
}
