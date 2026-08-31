"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Globe2, MapPin, Radar, Search, Table2 } from "lucide-react";
import { api, type ActorProfile, type ActorRow } from "@/lib/api";
import { nodesForActor, type GeoNode } from "@/lib/geoderive";
import Header from "../workbench/Header";
import Confidence from "../ui/Confidence";

const SangamMap = dynamic(() => import("./SangamMap"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-2)]"><span className="mono text-[10px] text-[var(--muted-2)]">LOADING MAP…</span></div>,
});

/**
 * SANGAM — the confluence of v2 (WHO: attribution) and v1 (WHERE: geofence map).
 * Pick an actor on the left (WHO); its footprints — markets, infra hosts, cash-out
 * exchanges — plot on the map (WHERE); a geofence ring marks the operational zone.
 * A wholly additive mode: nothing in the attribution workbench is touched.
 */
export default function Sangam() {
  const [rows, setRows] = useState<ActorRow[]>([]);
  const [q, setQ] = useState("");
  const [actorId, setActorId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ActorProfile | null>(null);
  const [zoneKm, setZoneKm] = useState(4000);
  const [picked, setPicked] = useState<GeoNode | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const d = await api.actors(q, 0, 40);
      if (!alive || !("actors" in d)) return;
      setRows(d.actors);
      if (!actorId && d.actors.length) setActorId(d.actors[0].actor_id);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    if (!actorId) return;
    let alive = true;
    setProfile(null); setPicked(null);
    (async () => {
      const d = await api.actor(actorId);
      if (alive && "ok" in d && d.ok) setProfile(d as ActorProfile);
    })();
    return () => { alive = false; };
  }, [actorId]);

  const nodes = useMemo(() => (profile ? nodesForActor(profile) : []), [profile]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />
      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 xl:flex-row">
        {/* WHO — actor picker + attribution */}
        <aside className="glass flex w-full shrink-0 flex-col overflow-hidden xl:w-[320px]">
          <div className="hairline flex items-center justify-between gap-2 px-3 py-2.5">
            <span className="mono flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              <Radar className="h-3 w-3 text-[var(--accent)]" /> Sangam · who × where
            </span>
            <Link href="/workbench" className="mono flex items-center gap-1 text-[9px] uppercase tracking-wider text-[var(--muted-2)] transition hover:text-[var(--c-high)]">
              <Table2 className="h-3 w-3" /> workbench
            </Link>
          </div>

          <div className="shrink-0 px-3 py-2">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-2)]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="find an actor"
                className="mono w-full border border-[var(--border)] bg-[var(--surface-2)] py-1.5 pl-8 pr-2 text-[11px] text-[var(--text)] placeholder:text-[var(--muted-2)] focus:border-[var(--accent-dim)] focus:outline-none" />
            </label>
          </div>

          <div className="slim min-h-0 flex-1 overflow-y-auto px-2 pb-2">
            <ul className="space-y-1">
              {rows.map((a) => (
                <li key={a.actor_id}>
                  <button onClick={() => setActorId(a.actor_id)}
                    className={`flex w-full items-center gap-2 rounded-[var(--radius)] border px-2.5 py-1.5 text-left transition ${
                      a.actor_id === actorId ? "border-[var(--accent-dim)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]" : "border-transparent hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]"
                    }`}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                    <span className="mono flex-1 truncate text-[11px] text-[var(--text)]">{a.label}</span>
                    <span className="mono tnum text-[10px] text-[var(--c-high)]">{a.attribution_confidence?.toFixed(2) ?? "—"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* WHO summary of the selected actor */}
          {profile && (
            <div className="hairline shrink-0 border-t px-3 py-3">
              <p className="mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">Attribution (who)</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="display truncate text-lg font-bold text-[var(--text)]">{profile.label}</span>
                <Confidence value={profile.attribution_confidence} size="sm" showBar={false} />
              </div>
              <p className="mono mt-1 text-[9px] text-[var(--muted-2)]">
                {profile.personas.length} personas · {profile.identifiers.length} identifiers · {profile.markets.length} markets
              </p>
            </div>
          )}
        </aside>

        {/* WHERE — the map */}
        <section className="relative min-h-[360px] min-w-0 flex-1">
          <SangamMap nodes={nodes} zoneKm={zoneKm} onPick={setPicked} />

          {/* legend + zone control */}
          <div className="pointer-events-auto absolute left-3 top-3 z-[500] glass p-2.5">
            <p className="mono mb-1.5 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
              <Globe2 className="h-3 w-3" /> Footprint map (where)
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {[["Market", "var(--accent)"], ["Infra host", "#9b7fd8"], ["Off-ramp", "var(--accent-2)"]].map(([l, c]) => (
                <span key={l} className="mono flex items-center gap-1 text-[8.5px] text-[var(--muted)]">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: c }} /> {l}
                </span>
              ))}
            </div>
            <div className="mt-2">
              <label className="mono flex items-center justify-between text-[8.5px] text-[var(--muted-2)]">
                <span>Geofence zone</span><span className="tnum text-[var(--muted)]">{zoneKm.toLocaleString()} km</span>
              </label>
              <input type="range" min={1000} max={9000} step={500} value={zoneKm}
                onChange={(e) => setZoneKm(Number(e.target.value))}
                className="mt-1 w-40 accent-[var(--accent)]" />
            </div>
          </div>

          {/* picked node detail */}
          {picked && (
            <div className="pointer-events-auto absolute bottom-3 left-3 z-[500] glass max-w-[280px] p-3">
              <p className="mono flex items-center gap-1.5 text-[9px] uppercase tracking-[0.14em] text-[var(--muted-2)]">
                <MapPin className="h-3 w-3" /> {picked.kind}
              </p>
              <p className="mono mt-1 break-all text-[11px] font-bold text-[var(--text)]">{picked.label}</p>
              <p className="mono mt-1 text-[9px] leading-relaxed text-[var(--muted)]">{picked.detail}</p>
              {picked.inferred && <p className="mono mt-1 text-[8.5px] text-[var(--muted-2)]">Location inferred (illustrative), not asserted.</p>}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
