"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Copy, Maximize2, Network, RotateCcw, X } from "lucide-react";
import type { ActorProfile } from "@/lib/api";
import type { GraphSelection } from "../three/ActorGraph3D";
import { prefersReducedMotion } from "@/lib/a11y";

const ActorGraph3D = dynamic(() => import("../three/ActorGraph3D"), { ssr: false });

// Kept local (not imported from the three module) so the heavy 3D bundle stays
// behind the dynamic import and never leaks into this panel's chunk.
const LEGEND: { color: string; label: string }[] = [
  { color: "#e8503a", label: "Actor / PGP" },
  { color: "#e9e9ee", label: "Persona" },
  { color: "#d9a441", label: "Wallet" },
  { color: "#5b9bd5", label: "Email" },
  { color: "#9b7fd8", label: "Infra" },
];

/**
 * The relationship graph, made explainable. A legend names every colour, a
 * caption says what the layout means, and clicking any node opens a detail card
 * that explains that entity and offers actions on it. Reduced motion / no WebGL
 * falls back to a legible 2D linkage list — the information always survives.
 */
export default function ActorGraphPanel({
  profile, onOpenPair, fill = false,
}: { profile: ActorProfile; onOpenPair: (id: string) => void; fill?: boolean }) {
  const [use3d, setUse3d] = useState(false);
  const [sel, setSel] = useState<GraphSelection>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [big, setBig] = useState(false);
  const [nonce, setNonce] = useState(0); // remount to reset the view

  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (window.innerWidth < 900) return;
    try {
      const c = document.createElement("canvas");
      if (c.getContext("webgl") || c.getContext("experimental-webgl")) setUse3d(true);
    } catch { /* no webgl */ }
  }, []);

  // Reset selection when the actor changes.
  useEffect(() => { setSel(null); setSelectedId(null); }, [profile.actor_id]);

  function handleSelect(s: GraphSelection) {
    if (s?.type === "pair") { onOpenPair(s.pairId); return; }
    setSel(s);
    setSelectedId(s?.type === "node" ? s.id : null);
  }

  return (
    <div
      className={`relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] transition-[height] ${
        fill ? "h-full" : big ? "h-[520px]" : "h-[340px]"
      }`}
      style={{ background: "radial-gradient(circle at 50% 38%, color-mix(in srgb, var(--elevated) 55%, transparent), var(--bg-2))" }}
    >
      {/* header row */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-2">
        <div className="flex items-center gap-1.5">
          <Network className="h-3 w-3 text-[var(--muted-2)]" />
          <span className="mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
            Relationship graph {use3d && "· drag to orbit · click a node"}
          </span>
        </div>
        {use3d && (
          <div className="pointer-events-auto flex items-center gap-1">
            <IconBtn title="Reset view" onClick={() => { setNonce((n) => n + 1); setSel(null); setSelectedId(null); }}>
              <RotateCcw className="h-3 w-3" />
            </IconBtn>
            <IconBtn title={big ? "Shrink" : "Expand"} onClick={() => setBig((b) => !b)}>
              <Maximize2 className="h-3 w-3" />
            </IconBtn>
          </div>
        )}
      </div>

      {use3d ? (
        <ActorGraph3D key={`${profile.actor_id}-${nonce}`} profile={profile} onSelect={handleSelect} selected={selectedId} />
      ) : (
        <Fallback2D profile={profile} onOpenPair={onOpenPair} />
      )}

      {/* legend */}
      {use3d && (
        <div className="pointer-events-none absolute bottom-2 left-2 z-10 flex flex-wrap gap-x-3 gap-y-1">
          {LEGEND.map((l) => (
            <span key={l.label} className="mono flex items-center gap-1 text-[8.5px] text-[var(--muted)]">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: l.color, boxShadow: `0 0 6px ${l.color}` }} />
              {l.label}
            </span>
          ))}
        </div>
      )}

      {/* caption — what the layout means */}
      {use3d && !sel && (
        <p className="pointer-events-none absolute bottom-2 right-2 z-10 max-w-[46%] text-right mono text-[8.5px] leading-snug text-[var(--muted-2)]">
          Edge thickness = evidence strength. Shared identifiers pull personas into one actor;
          a decoy sharing nothing drifts to the rim.
        </p>
      )}

      {/* selection detail card */}
      {use3d && sel?.type === "node" && (
        <NodeCard sel={sel} onClose={() => { setSel(null); setSelectedId(null); }} />
      )}
    </div>
  );
}

function NodeCard({ sel, onClose }: { sel: Extract<GraphSelection, { type: "node" }>; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const isWallet = sel.kind === "wallet";
  const explorer = isWallet ? `https://mempool.space/address/${sel.label.replace(/….*/, "")}` : null;
  return (
    <div className="absolute bottom-8 right-2 z-20 w-[230px] border border-[var(--border-2)] bg-[color-mix(in_srgb,var(--surface)_94%,black)] p-2.5 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-2">
        <span className="mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted-2)]">{sel.kind}</span>
        <button onClick={onClose} className="text-[var(--muted-2)] hover:text-[var(--text)]"><X className="h-3 w-3" /></button>
      </div>
      <p className="mono mt-1 break-all text-[11px] font-bold text-[var(--text)]">{sel.label}</p>
      <p className="mono mt-1.5 text-[9px] leading-relaxed text-[var(--muted)]">{sel.detail}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        <button
          onClick={() => { navigator.clipboard?.writeText(sel.label); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
          className="mono flex items-center gap-1 border border-[var(--border-2)] px-1.5 py-0.5 text-[9px] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--text)]"
        >
          <Copy className="h-2.5 w-2.5" /> {copied ? "copied" : "copy"}
        </button>
        {explorer && (
          <a href={explorer} target="_blank" rel="noreferrer"
            className="mono flex items-center gap-1 border border-[var(--border-2)] px-1.5 py-0.5 text-[9px] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)]">
            trace on chain ↗
          </a>
        )}
      </div>
    </div>
  );
}

function IconBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick: () => void }) {
  return (
    <button title={title} onClick={onClick}
      className="flex h-6 w-6 items-center justify-center border border-[var(--border-2)] bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--text)]">
      {children}
    </button>
  );
}

function Fallback2D({ profile, onOpenPair }: { profile: ActorProfile; onOpenPair: (id: string) => void }) {
  return (
    <div className="slim h-full overflow-y-auto p-3 pt-8">
      <p className="mono mb-2 text-[10px] text-[var(--muted)]">
        {profile.personas.length} personas · {profile.identifiers.length} identifiers ·{" "}
        {profile.linkages.length} linkages
      </p>
      <ul className="space-y-1">
        {profile.linkages.map((l) => (
          <li key={`${l.persona_a}|${l.persona_b}`}>
            <button
              onClick={() => onOpenPair(`${l.persona_a}|${l.persona_b}`)}
              className="mono flex w-full items-center justify-between gap-2 border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-left text-[10px] transition hover:border-[var(--accent-dim)]"
            >
              <span className="truncate text-[var(--muted)]">{l.persona_a} ↔ {l.persona_b}</span>
              <span className="tnum" style={{ color: l.confidence >= 0.75 ? "var(--c-high)" : "var(--muted-2)" }}>
                {l.confidence.toFixed(2)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
