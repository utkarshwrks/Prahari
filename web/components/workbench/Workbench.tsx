"use client";

import { useEffect, useState } from "react";
import { FlaskConical, Network, ScrollText, ShieldCheck, Waypoints } from "lucide-react";
import { api, type ActorProfile, type Timeline } from "@/lib/api";
import ActorList from "./ActorList";
import ActorProfileView from "./ActorProfile";
import ActorGraphPanel from "./ActorGraphPanel";
import AuditPanel from "./AuditPanel";
import TimingPanel from "./TimingPanel";
import ChainPanel from "./ChainPanel";
import EvidenceTrail from "./EvidenceTrail";
import Header from "./Header";

/**
 * The workbench, rebuilt for room to think.
 *
 *   rail        — who the candidates are
 *   centre      — the relationship graph as a large, readable focal element,
 *                 with the full profile beneath it
 *   side drawer — the proof: evidence trail, timing attack, chain flow, ledger,
 *                 as tabs so only one dense panel is on screen at a time
 *
 * The profile fetch lives here so the graph and the detail read one source. The
 * rail sits left or right depending on the per-load layout draw.
 */

type Tab = "evidence" | "timing" | "chain" | "audit";
const TABS: { id: Tab; label: string; icon: typeof Network }[] = [
  { id: "evidence", label: "Evidence", icon: ScrollText },
  { id: "timing", label: "Tor timing", icon: Waypoints },
  { id: "chain", label: "Chain flow", icon: FlaskConical },
  { id: "audit", label: "Ledger", icon: ShieldCheck },
];

export default function Workbench() {
  const [actorId, setActorId] = useState<string | null>(null);
  const [pairId, setPairId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ActorProfile | null>(null);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("evidence");
  const [railRight, setRailRight] = useState(false);

  useEffect(() => {
    setRailRight(document.documentElement.getAttribute("data-layout") === "b");
  }, []);

  // One fetch, shared by the graph and the profile detail.
  useEffect(() => {
    if (!actorId) { setProfile(null); setTimeline(null); setErr(null); return; }
    let alive = true;
    setProfile(null); setTimeline(null); setErr(null);
    (async () => {
      const d = await api.actor(actorId);
      if (!alive) return;
      if ("engine" in d && d.engine === "offline") setErr(d.detail ?? "Engine offline.");
      else if ("ok" in d && d.ok) setProfile(d as ActorProfile);
      else setErr((d as ActorProfile).detail ?? "Unknown actor.");
      const t = await api.timeline(actorId);
      if (alive && "ok" in t && t.ok) setTimeline(t as Timeline);
    })();
    return () => { alive = false; };
  }, [actorId]);

  // Opening a pair jumps the drawer to the evidence tab.
  function openPair(id: string) { setPairId(id); setTab("evidence"); }

  const rail = (
    <aside className="w-full shrink-0 xl:w-[300px]">
      <ActorList
        selected={actorId}
        onSelect={(id) => { setActorId(id); setPairId(null); }}
      />
    </aside>
  );

  const drawer = (
    <aside className="glass flex w-full min-w-0 shrink-0 flex-col overflow-hidden xl:w-[400px]">
      <div className="hairline flex shrink-0 items-center gap-0.5 p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`mono flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius)] px-2 py-2 text-[9.5px] uppercase tracking-[0.1em] transition ${
              tab === t.id
                ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--c-high)]"
                : "text-[var(--muted-2)] hover:text-[var(--muted)]"
            }`}
          >
            <t.icon className="h-3 w-3" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>
      {/* All four stay mounted (hidden when inactive) so a long-running job —
          the live Tor experiment above all — survives switching tabs. */}
      <div className="slim min-h-0 flex-1 overflow-y-auto">
        <div className={tab === "evidence" ? "h-full" : "hidden"}><EvidenceTrail pairId={pairId} /></div>
        <div className={tab === "timing" ? "h-full" : "hidden"}><TimingPanel /></div>
        <div className={tab === "chain" ? "h-full" : "hidden"}><ChainPanel /></div>
        <div className={tab === "audit" ? "h-full" : "hidden"}><AuditPanel /></div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />

      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 xl:flex-row xl:overflow-hidden">
        {!railRight && rail}

        {/* Centre: graph stage + profile detail */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <div className="relative h-[46vh] min-h-[320px] shrink-0 xl:h-auto xl:flex-1">
            {profile ? (
              <ActorGraphPanel profile={profile} onOpenPair={openPair} fill />
            ) : (
              <div className="glass flex h-full items-center justify-center">
                <p className="mono text-[10px] text-[var(--muted-2)]">
                  {err ?? (actorId ? "Rendering relationship graph…" : "Select an actor to begin.")}
                </p>
              </div>
            )}
          </div>

          <div className="min-h-[360px] shrink-0 xl:h-[42%] xl:min-h-0 xl:shrink">
            <ActorProfileView
              actorId={actorId}
              profile={profile}
              timeline={timeline}
              err={err}
              onOpenPair={openPair}
            />
          </div>
        </section>

        {drawer}
        {railRight && rail}
      </main>
    </div>
  );
}
