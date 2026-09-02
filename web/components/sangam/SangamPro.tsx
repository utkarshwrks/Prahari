"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Ban, Copy, Download, Layers, Loader2, MapPin, RefreshCw, Search, ShieldCheck, TriangleAlert,
} from "lucide-react";
import { api, type ActorRow } from "@/lib/api";
import {
  CLASS_MEANING, CLASS_SHAPE, DERIVED, RESOLVED, UNAVAILABLE, ageSeconds, comparable,
  distanceKm, isStale, plottable, sharedFacts, toCSV, toGeoJSON, unplaced,
  type ClassifiedPoint, type GeoClass,
} from "@/lib/sangamClass";
import Header from "../workbench/Header";
import SangamProMap from "./SangamProMap";

/**
 * SANGAM PRO (DEC-061, DEC-062).
 *
 * Every point on this map is either a RESOLVED fact with a full provenance
 * chain, or an explicitly labelled DERIVED region, or it is not on the map at
 * all and appears in the unplaced panel with the reason.
 *
 * The three are distinguished by SHAPE before colour, because colour is
 * skin-dependent and fails for colour-blind readers. The map is also not the
 * only path to the information: the marker list beside it is keyboard
 * navigable and carries the same facts, so a screen-reader user loses nothing
 * (INV-11).
 */

const LAYERS = [
  { id: "infrastructure", label: "Infrastructure", detail: "Resolved hosts from /geo/host." },
  { id: "derived", label: "Derived regions", detail: "Hosting and exchange regions. Never measured." },
  { id: "asn", label: "ASN clustering", detail: "Group by network operator, labelled with the org." },
  { id: "certificates", label: "Certificate reuse", detail: "Hosts named in the same CT certificate." },
  { id: "personas", label: "Persona overlay", detail: "Which persona touched which host." },
  { id: "jurisdiction", label: "Jurisdiction", detail: "Country of each resolved point; MLAT-relevant." },
] as const;

type LayerId = (typeof LAYERS)[number]["id"];

interface Footprint {
  ok: boolean;
  actor_id?: string;
  label?: string;
  points?: ClassifiedPoint[];
  edges?: { persona_id: string; handle: string; host: string; strength: number | null }[];
  summary?: { resolved: number; derived: number; unavailable: number; plotted: number; total: number };
  unplaced?: { host: string; reason: string }[];
  detail?: string;
}

function ClassChip({ cls }: { cls: GeoClass }) {
  return (
    <span
      data-class={cls}
      title={CLASS_MEANING[cls]}
      className="mono inline-flex items-center gap-1 border border-[var(--border-2)] px-1.5 py-0.5 text-[8.5px] uppercase tracking-[0.12em] text-[var(--muted)]"
    >
      {/* Shape first: filled disc, dashed ring, or a slash. */}
      {cls === RESOLVED && <span className="h-2 w-2 rounded-full bg-[var(--c-high)]" aria-hidden="true" />}
      {cls === DERIVED && (
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full border border-dashed border-[var(--muted)]"
        />
      )}
      {cls === UNAVAILABLE && <Ban className="h-2.5 w-2.5" />}
      {cls}
    </span>
  );
}

export default function SangamPro() {
  const [rows, setRows] = useState<ActorRow[]>([]);
  const [actorId, setActorId] = useState<string | null>(null);
  const [footprint, setFootprint] = useState<Footprint | null>(null);
  const [loading, setLoading] = useState(false);
  const [layers, setLayers] = useState<Record<LayerId, boolean>>({
    infrastructure: true, derived: true, asn: false,
    certificates: false, personas: false, jurisdiction: false,
  });
  const [selected, setSelected] = useState<ClassifiedPoint | null>(null);
  const [compareWith, setCompareWith] = useState<ClassifiedPoint | null>(null);
  const [query, setQuery] = useState("");
  const [tilesFailed, setTilesFailed] = useState(false);
  const [reResolving, setReResolving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [lookupHost, setLookupHost] = useState("");
  const [lookedUp, setLookedUp] = useState<ClassifiedPoint[]>([]);
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const d = await api.actors("", 0, 60);
      if (!alive || !("actors" in d)) return;
      setRows(d.actors);
      if (d.actors.length) setActorId((a) => a ?? d.actors[0].actor_id);
    })();
    return () => { alive = false; };
  }, []);

  const load = useCallback(async (id: string, force = false) => {
    setLoading(true);
    setSelected(null);
    setCompareWith(null);
    const res = await fetch(
      `/api/engine/geo/actor/${encodeURIComponent(id)}/footprint${force ? "?force=1" : ""}`,
      { cache: "no-store" }
    ).then((r) => r.json()).catch(() => ({ ok: false, detail: "The engine did not answer." }));
    setFootprint(res);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (actorId) void load(actorId);
  }, [actorId, load]);

  /**
   * The actor's own footprint, plus anything the analyst looked up by hand.
   *
   * Hand-looked-up hosts live in their own state and are merged here, so a
   * lookup never silently becomes part of the actor's evidence -- it is on the
   * map because someone asked for it.
   */
  const points = useMemo(
    () => [...(footprint?.points ?? []), ...lookedUp],
    [footprint, lookedUp]
  );
  const shown = useMemo(() => {
    let out = plottable(points);
    if (!layers.infrastructure) out = out.filter((p) => p.class !== RESOLVED);
    if (!layers.derived) out = out.filter((p) => p.class !== DERIVED);
    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((p) =>
        [p.host, p.ip, p.asn_org, p.country, String(p.asn ?? "")]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    return out;
  }, [points, layers, query]);

  const notPlaced = useMemo(() => unplaced(points), [points]);
  const summary = footprint?.summary;

  /**
   * Locate any host on demand.
   *
   * The search from §5.3, and the most direct demonstration of INV-1 in the
   * product: type a `.onion` and it is refused BY DESIGN, appearing in the
   * unplaced panel rather than as an error.
   */
  async function locate() {
    const h = lookupHost.trim();
    if (!h) return;
    setLookingUp(true);
    setNote(null);
    const res = await fetch(`/api/engine/geo/host?host=${encodeURIComponent(h)}`, {
      cache: "no-store",
    }).then((r) => r.json()).catch(() => null);
    setLookingUp(false);
    if (!res?.ok) {
      setNote(`The engine did not answer for ${h}.`);
      return;
    }
    setLookedUp((prev) => [...prev.filter((p) => p.host !== res.host), res as ClassifiedPoint]);
    setLookupHost("");
    setNote(
      res.class === UNAVAILABLE
        ? `${res.host}: ${res.reason} — listed under Unplaced.`
        : `${res.host}: ${res.class}.`
    );
  }

  async function reResolve(host: string) {
    setReResolving(true);
    const fresh = await fetch(`/api/engine/geo/host?host=${encodeURIComponent(host)}&force=1`, {
      cache: "no-store",
    }).then((r) => r.json()).catch(() => null);
    setReResolving(false);
    if (fresh?.ok) {
      // Show the new answer BESIDE the old one rather than replacing it: an
      // analyst comparing a re-resolution needs both.
      setNote(
        `Re-resolved ${host}: ${fresh.class}` +
          (fresh.ip ? ` · ${fresh.ip}` : "") +
          (fresh.city ? ` · ${fresh.city}, ${fresh.country}` : "") +
          `. The point above is the earlier answer.`
      );
    } else {
      setNote(`Re-resolution of ${host} did not return an answer.`);
    }
  }

  function download(name: string, body: string, mime: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: mime }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const comparison = selected && compareWith ? comparable(selected, compareWith) : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />

      <div className="flex min-h-0 flex-1 gap-3 p-3">
        {/* ---- left: actors, layers, legend ------------------------------ */}
        <aside className="glass slim w-[250px] shrink-0 overflow-y-auto p-3" aria-label="SANGAM controls">
          <p className="mono mb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--text)]">
            SANGAM · WHO × WHERE
          </p>

          <label className="relative mb-2 block">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--muted-2)]" />
            <span className="sr-only">Search hosts, IPs, ASNs and countries</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="host, IP, ASN, country"
              className="mono w-full border border-[var(--border)] bg-[var(--surface-2)] py-1.5 pl-7 pr-2 text-[10px] text-[var(--text)] outline-none focus:border-[var(--accent-dim)]"
            />
          </label>

          <p className="mono mb-1 text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
            Locate a host
          </p>
          <div className="mb-1 flex gap-1">
            <input
              value={lookupHost}
              onChange={(e) => setLookupHost(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void locate();
              }}
              placeholder="example.com, or a .onion"
              aria-label="Locate a host"
              className="mono min-w-0 flex-1 border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-1.5 text-[10px] text-[var(--text)] outline-none focus:border-[var(--accent-dim)]"
            />
            <button
              onClick={() => void locate()}
              disabled={lookingUp || !lookupHost.trim()}
              className="mono shrink-0 border border-[var(--border-2)] px-2 text-[9px] uppercase tracking-[0.1em] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)] disabled:opacity-40"
            >
              {lookingUp ? <Loader2 className="h-3 w-3 animate-spin" /> : "Go"}
            </button>
          </div>
          <p className="mono mb-3 text-[8px] leading-relaxed text-[var(--muted-2)]">
            A <span className="text-[var(--text)]">.onion</span> is refused by design and appears
            under Unplaced. PRAHARI never issues a DNS query for one (INV-1).
          </p>

          {note && (
            <p
              role="status"
              data-testid="lookup-note"
              className="mono mb-3 border border-[var(--border)] bg-[var(--surface-2)] p-1.5 text-[8.5px] leading-relaxed text-[var(--muted)]"
            >
              {note}
            </p>
          )}

          <p className="mono mb-1 text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">Actor</p>
          <select
            value={actorId ?? ""}
            onChange={(e) => setActorId(e.target.value)}
            aria-label="Actor"
            className="mono mb-3 w-full border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-1.5 text-[10px] text-[var(--text)]"
          >
            {rows.map((r) => (
              <option key={r.actor_id} value={r.actor_id}>
                {r.label} · {r.actor_id}
              </option>
            ))}
          </select>

          {/* ---- the legend: shape first ---- */}
          <p className="mono mb-1 text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
            Coordinate class
          </p>
          <ul className="mb-3 space-y-1.5" data-testid="class-legend">
            {([RESOLVED, DERIVED, UNAVAILABLE] as GeoClass[]).map((c) => (
              <li key={c}>
                <ClassChip cls={c} />
                <p className="mono mt-0.5 text-[8px] leading-relaxed text-[var(--muted-2)]">
                  {CLASS_MEANING[c]}
                </p>
              </li>
            ))}
          </ul>

          <p className="mono mb-1 text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">Layers</p>
          <ul className="mb-3 space-y-1">
            {LAYERS.map((l) => (
              <li key={l.id}>
                <label className="mono flex items-start gap-1.5 text-[9px] text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={layers[l.id]}
                    onChange={(e) => setLayers((s) => ({ ...s, [l.id]: e.target.checked }))}
                    className="mt-0.5"
                  />
                  <span>
                    {l.label}
                    <span className="block text-[8px] text-[var(--muted-2)]">{l.detail}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <p className="mono mb-1 text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">Export</p>
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() =>
                download(
                  `sangam-${actorId}.geojson`,
                  toGeoJSON(points, { actor_id: actorId, actor: footprint?.label }),
                  "application/geo+json"
                )
              }
              className="mono flex items-center justify-center gap-1 border border-[var(--border-2)] py-1 text-[8.5px] uppercase tracking-[0.1em] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)]"
            >
              <Download className="h-2.5 w-2.5" /> GeoJSON
            </button>
            <button
              onClick={() => download(`sangam-${actorId}.csv`, toCSV(points), "text/csv")}
              className="mono flex items-center justify-center gap-1 border border-[var(--border-2)] py-1 text-[8.5px] uppercase tracking-[0.1em] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)]"
            >
              <Download className="h-2.5 w-2.5" /> CSV
            </button>
          </div>
          <p className="mono mt-1 text-[8px] leading-relaxed text-[var(--muted-2)]">
            Every point keeps its class, and unavailable points are exported with null geometry rather
            than dropped — so nothing is silently missing from the file.
          </p>
        </aside>

        {/* ---- centre: the map ------------------------------------------- */}
        <section className="glass relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="hairline flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-1.5">
            <p className="mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">
              {footprint?.label ?? actorId ?? "—"}
              {summary && (
                <span className="ml-2 normal-case tracking-normal text-[var(--muted-2)]">
                  {summary.resolved} resolved · {summary.derived} derived · {summary.unavailable} unplaced
                </span>
              )}
            </p>
            {loading && (
              <span className="mono flex items-center gap-1 text-[9px] text-[var(--muted-2)]">
                <Loader2 className="h-3 w-3 animate-spin" /> resolving
              </span>
            )}
          </div>

          {tilesFailed && (
            <p
              data-testid="tile-failure"
              className="mono shrink-0 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-3 py-1.5 text-[9px] text-[var(--muted)]"
            >
              The map tile provider is unreachable. Points are drawn on a plain graticule — the
              positions are correct, the basemap is missing. This is a network problem, not a bug.
            </p>
          )}

          <div className="min-h-0 flex-1">
            <SangamProMap
              points={shown}
              selected={selected}
              compareWith={compareWith}
              onSelect={setSelected}
              onTileError={() => setTilesFailed(true)}
            />
          </div>
        </section>

        {/* ---- right: marker list, detail, unplaced ---------------------- */}
        <aside className="glass slim w-[330px] shrink-0 overflow-y-auto p-3" aria-label="Points">
          {selected ? (
            <div>
              <button
                onClick={() => setSelected(null)}
                className="mono mb-2 text-[8.5px] uppercase tracking-[0.12em] text-[var(--muted-2)] hover:text-[var(--text)]"
              >
                Back to the list
              </button>
              <div className="mb-2 flex items-center gap-2">
                <ClassChip cls={selected.class} />
                {isStale(selected) && (
                  <span className="mono border border-[var(--warn)] px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] text-[var(--warn)]">
                    stale · {Math.round((ageSeconds(selected) ?? 0) / 3600)}h old
                  </span>
                )}
              </div>
              <p className="mono break-all text-[12px] font-bold text-[var(--text)]">{selected.host}</p>
              <p className="mono mt-1 text-[9px] leading-relaxed text-[var(--muted-2)]">
                {selected.class === DERIVED ? selected.reason : CLASS_MEANING[selected.class]}
              </p>

              {/* ---- the resolution chain, top to bottom ---- */}
              <h4 className="mono mb-1 mt-3 text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">
                Resolution chain
              </h4>
              <ol className="space-y-1" data-testid="resolution-chain">
                {selected.resolution_chain.map((s, i) => (
                  <li
                    key={`${s.step}-${i}`}
                    className="mono border-l-2 pl-2 text-[9px] leading-relaxed"
                    style={{ borderColor: s.ok ? "var(--ok)" : "var(--warn)" }}
                  >
                    <span className="uppercase tracking-[0.1em] text-[var(--muted-2)]">{s.step}</span>
                    <br />
                    <span className="text-[var(--text)]">{s.detail}</span>
                    <br />
                    <span className="text-[var(--muted-2)]">{s.at.slice(11, 19)} UTC</span>
                  </li>
                ))}
                {selected.resolution_chain.length === 0 && (
                  <li className="mono text-[9px] text-[var(--muted-2)]">No chain was recorded.</li>
                )}
              </ol>

              <dl className="mono mt-3 space-y-0.5 text-[9.5px]">
                {([
                  ["IP", selected.ip],
                  ["Reverse DNS", selected.reverse_dns],
                  ["ASN", selected.asn ? `AS${selected.asn}` : null],
                  ["Operator", selected.asn_org],
                  ["City", selected.city],
                  ["Country", selected.country],
                  ["Provider", selected.provider],
                  ["Resolver", selected.resolver_used],
                  ["TTL", selected.ttl],
                  ["Coordinate", selected.lat !== null ? `${selected.lat}, ${selected.lng}` : null],
                  ["Resolved at", selected.resolved_at?.slice(0, 19).replace("T", " ")],
                  ["Cache age", selected.cache_age_s !== null ? `${selected.cache_age_s}s` : null],
                  ["Derivation", selected.derivation_rule],
                ] as [string, unknown][]).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 border-b border-[var(--border)] py-0.5 last:border-0">
                    <dt className="shrink-0 text-[var(--muted-2)]">{k}</dt>
                    <dd className="min-w-0 break-all text-right text-[var(--text)]">
                      {/* "not available" rather than a blank: a missing field
                          must read as absent, never as an empty measurement. */}
                      {v === null || v === undefined || v === "" ? (
                        <span className="text-[var(--muted-2)]">not available</span>
                      ) : (
                        String(v)
                      )}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <button
                  onClick={() => void reResolve(selected.host)}
                  disabled={reResolving || selected.class === UNAVAILABLE}
                  className="mono flex items-center gap-1 border border-[var(--border-2)] px-1.5 py-1 text-[8.5px] uppercase tracking-[0.1em] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)] disabled:opacity-40"
                >
                  <RefreshCw className={`h-2.5 w-2.5 ${reResolving ? "animate-spin" : ""}`} /> Re-resolve now
                </button>
                <button
                  onClick={() => navigator.clipboard?.writeText(selected.host)}
                  className="mono flex items-center gap-1 border border-[var(--border-2)] px-1.5 py-1 text-[8.5px] uppercase tracking-[0.1em] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)]"
                >
                  <Copy className="h-2.5 w-2.5" /> Copy host
                </button>
                {actorId && (
                  <Link
                    href={`/workbench/actor/${actorId}`}
                    className="mono flex items-center gap-1 border border-[var(--border-2)] px-1.5 py-1 text-[8.5px] uppercase tracking-[0.1em] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)]"
                  >
                    <ShieldCheck className="h-2.5 w-2.5" /> Open dossier
                  </Link>
                )}
              </div>

              {note && (
                <p role="status" className="mono mt-2 border border-[var(--border)] bg-[var(--surface-2)] p-1.5 text-[8.5px] leading-relaxed text-[var(--muted)]">
                  {note}
                </p>
              )}

              {/* ---- two-point comparison ---- */}
              <h4 className="mono mb-1 mt-3 text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">
                Compare with
              </h4>
              <select
                value={compareWith?.host ?? ""}
                onChange={(e) =>
                  setCompareWith(shown.find((p) => p.host === e.target.value) ?? null)
                }
                aria-label="Second point"
                className="mono w-full border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-1 text-[9.5px] text-[var(--text)]"
              >
                <option value="">Select a second point</option>
                {shown.filter((p) => p.host !== selected.host).map((p) => (
                  <option key={p.host} value={p.host}>
                    {p.host} ({p.class})
                  </option>
                ))}
              </select>

              {comparison && (
                <div data-testid="comparison" className="mt-2">
                  {comparison.ok ? (
                    <>
                      <p className="mono text-[10px] text-[var(--text)]">
                        {distanceKm(selected, compareWith!)?.toLocaleString()} km apart
                      </p>
                      <ul className="mono mt-1 space-y-0.5 text-[9px] text-[var(--muted)]">
                        {sharedFacts(selected, compareWith!).map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                        {sharedFacts(selected, compareWith!).length === 0 && (
                          <li className="text-[var(--muted-2)]">They share nothing recorded.</li>
                        )}
                      </ul>
                    </>
                  ) : (
                    <p className="mono flex items-start gap-1.5 border border-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] p-1.5 text-[9px] leading-relaxed text-[var(--muted)]">
                      <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-[var(--warn)]" />
                      {comparison.warning}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* ---- the keyboard-navigable marker list ---- */}
              <h3 className="mono mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                <MapPin className="h-3 w-3" /> Points ({shown.length})
              </h3>
              <p className="mono mb-2 text-[8px] leading-relaxed text-[var(--muted-2)]">
                The map is not the only path to this information. Every point is listed here with the
                same facts, reachable by keyboard.
              </p>
              <ul className="space-y-1" data-testid="marker-list">
                {shown.map((p) => (
                  <li key={p.host}>
                    <button
                      onClick={() => setSelected(p)}
                      className="mono w-full border border-[var(--border)] bg-[var(--surface-2)] p-1.5 text-left transition hover:border-[var(--accent-dim)]"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[10px] text-[var(--text)]">{p.host}</span>
                        <ClassChip cls={p.class} />
                      </span>
                      <span className="mt-0.5 block text-[8.5px] text-[var(--muted-2)]">
                        {p.class === RESOLVED
                          ? `${p.city ?? "location"}, ${p.country ?? ""} · ${p.ip ?? ""}`
                          : p.derivation_rule ?? p.reason}
                      </span>
                    </button>
                  </li>
                ))}
                {shown.length === 0 && (
                  <li className="mono py-4 text-center text-[10px] text-[var(--muted-2)]">
                    {loading ? "Resolving hosts…" : "No points match this view."}
                  </li>
                )}
              </ul>

              {/* ---- the unplaced panel ---- */}
              <h3 className="mono mb-1.5 mt-4 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                <Ban className="h-3 w-3" /> Unplaced ({notPlaced.length})
              </h3>
              <p className="mono mb-2 text-[8px] leading-relaxed text-[var(--muted-2)]">
                Nothing here is on the map, and each row says why. A host that could not be placed is
                a fact, not an omission.
              </p>
              <ul className="space-y-1" data-testid="unplaced-list">
                {notPlaced.map((p) => (
                  <li
                    key={p.host}
                    className="mono border border-[var(--border)] bg-[var(--surface-2)] p-1.5 text-[9.5px]"
                  >
                    <span className="block truncate text-[var(--text)]">{p.host}</span>
                    <span className="mt-0.5 block text-[8.5px] text-[var(--muted-2)]">{p.reason}</span>
                  </li>
                ))}
                {notPlaced.length === 0 && (
                  <li className="mono py-2 text-center text-[9px] text-[var(--muted-2)]">
                    Every host was placed.
                  </li>
                )}
              </ul>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
