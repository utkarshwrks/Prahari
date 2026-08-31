"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Crosshair, Globe2, Layers, Loader2, MapPin, Radar, Search, Table2, Waypoints,
} from "lucide-react";
import { api, type ActorProfile, type ActorRow } from "@/lib/api";
import { centroid, haversineKm, nodesForActor, type GeoNode } from "@/lib/geoderive";
import Header from "../workbench/Header";

const SangamMap = dynamic(() => import("./SangamMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-2)]">
      <span className="mono flex items-center gap-2 text-[10px] text-[var(--muted-2)]"><Loader2 className="h-3 w-3 animate-spin" /> LOADING MAP…</span>
    </div>
  ),
});

/**
 * SANGAM — संगम, the confluence of v2 (WHO: attribution) and v1 (WHERE: geofence).
 * Pick an actor; its footprints plot on a world map with GENUINE host→region
 * geolocation (DNS + geo-IP) where a host resolves, inferred and labelled where
 * it does not. Entirely additive — the attribution workbench is untouched.
 */
export default function Sangam() {
  const [rows, setRows] = useState<ActorRow[]>([]);
  const [q, setQ] = useState("");
  const [actorId, setActorId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ActorProfile | null>(null);
  const [geo, setGeo] = useState<Record<string, GeoNode>>({}); // resolved overrides by node id
  const [custom, setCustom] = useState<GeoNode[]>([]);          // user-located hosts
  const [zoneKm, setZoneKm] = useState(4000);
  const [picked, setPicked] = useState<GeoNode | null>(null);
  const [hostQ, setHostQ] = useState("");
  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState<string | null>(null);

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
    setProfile(null); setPicked(null); setGeo({}); setCustom([]);
    (async () => {
      const d = await api.actor(actorId);
      if (alive && "ok" in d && d.ok) setProfile(d as ActorProfile);
    })();
    return () => { alive = false; };
  }, [actorId]);

  const base = useMemo(() => (profile ? nodesForActor(profile) : []), [profile]);

  // Genuinely geolocate the actor's infra hosts (DNS + geo-IP), upgrade resolved.
  useEffect(() => {
    if (!profile) return;
    let alive = true;
    const hosts = profile.infrastructure.map((x) => x.clearnet_host);
    (async () => {
      const out: Record<string, GeoNode> = {};
      await Promise.all(hosts.map(async (h) => {
        const r = await api.geoHost(h);
        if ("resolved" in r && r.resolved && r.lat != null && r.lng != null) {
          out["infra:" + h] = {
            id: "infra:" + h, label: h, kind: "infra", lat: r.lat, lng: r.lng, inferred: false,
            detail: `Clearnet host, genuinely geolocated via DNS + geo-IP.`,
            ip: r.ip, city: r.city, country: r.country, flag: r.flag, asn: r.asn, org: r.org,
          };
        }
      }));
      if (alive) setGeo(out);
    })();
    return () => { alive = false; };
  }, [profile]);

  const nodes = useMemo(
    () => [...base.map((n) => geo[n.id] ?? n), ...custom],
    [base, geo, custom],
  );
  const center = useMemo(() => centroid(nodes), [nodes]);

  const stats = useMemo(() => {
    const countries = new Set(nodes.map((n) => n.country).filter(Boolean));
    const inZone = nodes.filter((n) => haversineKm(center, [n.lat, n.lng]) <= zoneKm).length;
    const real = nodes.filter((n) => !n.inferred).length;
    return { total: nodes.length, inZone, countries: countries.size, real };
  }, [nodes, center, zoneKm]);

  async function locate() {
    const h = hostQ.trim();
    if (!h) return;
    setLocating(true); setLocErr(null);
    const r = await api.geoHost(h);
    setLocating(false);
    if ("resolved" in r && r.resolved && r.lat != null && r.lng != null) {
      const node: GeoNode = {
        id: "custom:" + h, label: r.host, kind: "infra", lat: r.lat, lng: r.lng, inferred: false,
        detail: "Host you located — genuine DNS + geo-IP resolution.",
        ip: r.ip, city: r.city, country: r.country, flag: r.flag, asn: r.asn, org: r.org,
      };
      setCustom((c) => [...c.filter((x) => x.id !== node.id), node]);
      setPicked(node); setHostQ("");
    } else {
      setLocErr(("detail" in r && r.detail) ? r.detail : "could not resolve");
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />
      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 xl:flex-row">
        {/* ── WHO rail ── */}
        <aside className="glass flex w-full shrink-0 flex-col overflow-hidden xl:w-[326px]">
          <div className="hairline flex items-center justify-between gap-2 px-3.5 py-3">
            <div>
              <p className="display text-lg font-bold leading-none">
                <span className="grad-text">SANGAM</span>
              </p>
              <p className="mono mt-1 flex items-center gap-1 text-[8.5px] uppercase tracking-[0.2em] text-[var(--muted-2)]">
                <Radar className="h-2.5 w-2.5" /> who × where · संगम
              </p>
            </div>
            <Link href="/workbench" className="mono flex items-center gap-1 rounded-[var(--radius)] border border-[var(--border-2)] px-2 py-1 text-[8.5px] uppercase tracking-wider text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)]">
              <Table2 className="h-3 w-3" /> workbench
            </Link>
          </div>

          <div className="shrink-0 px-3 pb-1 pt-2">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted-2)]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="find an actor"
                className="mono w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] py-2 pl-8 pr-2 text-[11px] text-[var(--text)] placeholder:text-[var(--muted-2)] focus:border-[var(--accent-dim)] focus:outline-none" />
            </label>
          </div>

          <div className="slim min-h-0 flex-1 overflow-y-auto px-2 py-1">
            <ul className="space-y-0.5">
              {rows.map((a) => {
                const on = a.actor_id === actorId;
                return (
                  <li key={a.actor_id}>
                    <button onClick={() => setActorId(a.actor_id)}
                      className={`flex w-full items-center gap-2 rounded-[var(--radius)] border px-2.5 py-1.5 text-left transition ${
                        on ? "border-[var(--accent-dim)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]" : "border-transparent hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]"
                      }`}>
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" style={{ boxShadow: on ? "0 0 8px var(--accent)" : "none" }} />
                      <span className="mono flex-1 truncate text-[11px] text-[var(--text)]">{a.label}</span>
                      <span className="mono tnum text-[10px] text-[var(--c-high)]">{a.attribution_confidence?.toFixed(2) ?? "—"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* WHO summary */}
          {profile && (
            <div className="hairline shrink-0 border-t px-3.5 py-3">
              <p className="mono text-[8.5px] uppercase tracking-[0.18em] text-[var(--muted-2)]">Attribution · who</p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="display truncate text-xl font-bold text-[var(--text)]">{profile.label}</span>
                <span className="mono tnum text-lg font-bold text-[var(--c-high)]">{profile.attribution_confidence?.toFixed(3) ?? "—"}</span>
              </div>
              <span className="bar mt-1 block">
                <span style={{ width: `${(profile.attribution_confidence ?? 0) * 100}%`, background: "linear-gradient(90deg,var(--accent-dim),var(--accent))" }} />
              </span>
              <p className="mono mt-2 text-[9px] text-[var(--muted-2)]">
                {profile.personas.length} personas · {profile.identifiers.length} identifiers · {profile.markets.length} markets
              </p>
            </div>
          )}

          {/* locate any real host */}
          <div className="hairline shrink-0 border-t px-3.5 py-3">
            <p className="mono mb-1.5 flex items-center gap-1.5 text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
              <Crosshair className="h-2.5 w-2.5" /> Locate any host (live)
            </p>
            <div className="flex gap-1.5">
              <input value={hostQ} onChange={(e) => setHostQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") locate(); }}
                placeholder="e.g. github.com"
                className="mono min-w-0 flex-1 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-[10px] text-[var(--text)] placeholder:text-[var(--muted-2)] focus:border-[var(--accent-dim)] focus:outline-none" />
              <button onClick={locate} disabled={locating}
                className="mono flex items-center gap-1 rounded-[var(--radius)] border border-[var(--accent-dim)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-2.5 py-1.5 text-[9px] uppercase tracking-wider text-[var(--c-high)] transition hover:bg-[color-mix(in_srgb,var(--accent)_24%,transparent)] disabled:opacity-50">
                {locating ? <Loader2 className="h-3 w-3 animate-spin" /> : "locate"}
              </button>
            </div>
            {locErr && <p className="mono mt-1 text-[8.5px] text-[var(--c-high)]">{locErr}</p>}
            <p className="mono mt-1 text-[8px] leading-relaxed text-[var(--muted-2)]">Real DNS + geo-IP — proves the pipeline on any live domain.</p>
          </div>
        </aside>

        {/* ── WHERE map ── */}
        <section className="relative min-h-[360px] min-w-0 flex-1">
          <SangamMap nodes={nodes} zoneKm={zoneKm} onPick={setPicked} picked={picked} />

          {/* top-left: legend + zone */}
          <div className="pointer-events-auto absolute left-3 top-3 z-[500] glass p-3">
            <p className="mono mb-2 flex items-center gap-1.5 text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
              <Globe2 className="h-3 w-3" /> Footprint map · where
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {[["Market", "var(--accent)"], ["Infra host", "#9b7fd8"], ["Off-ramp", "var(--accent-2)"]].map(([l, c]) => (
                <span key={l} className="mono flex items-center gap-1 text-[8.5px] text-[var(--muted)]">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} /> {l}
                </span>
              ))}
            </div>
            <div className="mt-2.5">
              <label className="mono flex items-center justify-between text-[8.5px] text-[var(--muted-2)]">
                <span className="flex items-center gap-1"><Waypoints className="h-2.5 w-2.5" /> Geofence zone</span>
                <span className="tnum text-[var(--muted)]">{zoneKm.toLocaleString()} km</span>
              </label>
              <input type="range" min={1000} max={9000} step={500} value={zoneKm}
                onChange={(e) => setZoneKm(Number(e.target.value))}
                className="mt-1 w-44 accent-[var(--accent)]" />
            </div>
          </div>

          {/* top-right: live stats */}
          <div className="pointer-events-none absolute right-3 top-3 z-[500] glass flex gap-4 px-3.5 py-2.5">
            {[["Footprints", stats.total], ["In zone", stats.inZone], ["Countries", stats.countries], ["Geo-resolved", stats.real]].map(([l, v]) => (
              <div key={l as string} className="text-center">
                <p className="mono tnum text-base font-bold text-[var(--c-high)]">{v as number}</p>
                <p className="mono text-[7.5px] uppercase tracking-[0.12em] text-[var(--muted-2)]">{l as string}</p>
              </div>
            ))}
          </div>

          {/* bottom-left: focus card */}
          {picked && (
            <div className="pointer-events-auto absolute bottom-3 left-3 z-[500] glass w-[290px] p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="mono flex items-center gap-1.5 text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
                  <MapPin className="h-3 w-3" /> {picked.kind}
                </p>
                <span className={`mono rounded-full px-1.5 py-0.5 text-[7.5px] uppercase tracking-wider ${picked.inferred ? "bg-[var(--surface-2)] text-[var(--muted-2)]" : "bg-[color-mix(in_srgb,var(--ok)_18%,transparent)] text-[var(--ok)]"}`}>
                  {picked.inferred ? "inferred" : "geo-resolved"}
                </span>
              </div>
              <p className="mono mt-1.5 break-all text-[12px] font-bold text-[var(--text)]">{picked.flag ? picked.flag + " " : ""}{picked.label}</p>
              {picked.ip && (
                <div className="mono mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[9px]">
                  <span className="text-[var(--muted-2)]">location</span><span className="text-[var(--text)]">{[picked.city, picked.country].filter(Boolean).join(", ") || "—"}</span>
                  <span className="text-[var(--muted-2)]">ip</span><span className="text-[var(--text)]">{picked.ip}</span>
                  {picked.asn != null && (<><span className="text-[var(--muted-2)]">network</span><span className="truncate text-[var(--text)]">AS{picked.asn} {picked.org}</span></>)}
                </div>
              )}
              <p className="mono mt-2 text-[9px] leading-relaxed text-[var(--muted)]">{picked.detail}</p>
              <p className="mono mt-1.5 flex items-center gap-1 text-[8.5px] text-[var(--muted-2)]">
                <Layers className="h-2.5 w-2.5" />
                {haversineKm(center, [picked.lat, picked.lng]).toLocaleString()} km from centroid ·{" "}
                {haversineKm(center, [picked.lat, picked.lng]) <= zoneKm ? "in operational zone" : "outside zone"}
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
