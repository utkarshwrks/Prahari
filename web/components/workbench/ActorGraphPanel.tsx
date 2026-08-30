"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Network } from "lucide-react";
import type { ActorProfile } from "@/lib/api";
import { prefersReducedMotion } from "@/lib/a11y";

const ActorGraph3D = dynamic(() => import("../three/ActorGraph3D"), { ssr: false });

/**
 * The 3D actor graph, with an honest 2D fallback. On reduced motion, without
 * WebGL, or on a small screen it shows a static node/edge summary rather than a
 * broken canvas — the information survives, the spectacle is optional.
 */
export default function ActorGraphPanel({
  profile, onOpenPair,
}: { profile: ActorProfile; onOpenPair: (id: string) => void }) {
  const [use3d, setUse3d] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    if (window.innerWidth < 900) return;
    try {
      const c = document.createElement("canvas");
      if (c.getContext("webgl") || c.getContext("experimental-webgl")) setUse3d(true);
    } catch { /* no webgl */ }
  }, []);

  return (
    <div className="relative h-[300px] overflow-hidden border border-[var(--border)] bg-[radial-gradient(circle_at_50%_50%,#12131a,#0b0b0e)]">
      <div className="pointer-events-none absolute left-2 top-2 z-10 flex items-center gap-1.5">
        <Network className="h-3 w-3 text-[var(--muted-2)]" />
        <span className="mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
          Relationship graph {use3d && "· drag to orbit"}
        </span>
      </div>

      {use3d ? (
        <ActorGraph3D profile={profile} onOpenPair={onOpenPair} />
      ) : (
        <Fallback2D profile={profile} onOpenPair={onOpenPair} />
      )}
    </div>
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
