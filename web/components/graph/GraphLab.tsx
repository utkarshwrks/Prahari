"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Boxes, Download, Grid3x3, GitCompare, Layers, List, Network, RotateCcw,
  Share2, Sigma, Waypoints,
} from "lucide-react";
import ActorGraphPanel from "@/components/workbench/ActorGraphPanel";
import {
  Bipartite, Community, Diff, EvidenceDag, Ego, Force2D, LinkageList, Matrix, Sankey,
  Temporal, Caption,
  BIPARTITE_CAPTION, COMMUNITY_CAPTION, DAG_CAPTION, DIFF_CAPTION, EGO_CAPTION,
  FORCE2D_CAPTION, LIST_CAPTION, MATRIX_CAPTION, SANKEY_CAPTION, TEMPORAL_CAPTION,
  type ViewProps,
} from "./views";
import NodeInspector from "./NodeInspector";
import {
  DEFAULT_FILTERS, DEFAULT_LAYOUT, HAIRBALL_LIMIT, applyFilters, buildModel, timelineDates,
  type GraphFilters, type LayoutParams,
} from "@/lib/graphModel";
import { SIGNAL_LABEL, SIGNAL_ROOTS, signalVar, ENTITY_COLOR } from "@/lib/signals";
import { prefersReducedMotion } from "@/lib/a11y";
import { api, type ActorProfile, type ClusterResult, type FusionModel, type PairScore } from "@/lib/api";
import {
  download, exportName, provenanceLine, provenanceOf, toGraphML, toJSON, toPNG, toSVG,
} from "@/lib/graphExport";

/**
 * THE GRAPH INTELLIGENCE LAB (DEC-057).
 *
 * One 3D force graph becomes a workspace where the analyst chooses the
 * representation that answers their question -- and every representation
 * explains itself in a caption stating what its layout MEANS.
 *
 * The 3D view is the existing `ActorGraphPanel`, mounted unchanged. This
 * component wraps it; it does not replace it (the prime directive).
 *
 * Every control serialises into the query string, so a view an analyst spent
 * ten minutes narrowing can be pasted to a colleague.
 */

type ViewId =
  | "force3d" | "force2d" | "ego" | "matrix" | "dag" | "temporal"
  | "bipartite" | "sankey" | "community" | "diff" | "list";

const VIEWS: { id: ViewId; label: string; icon: typeof Network; answers: string }[] = [
  { id: "force3d", label: "3D force", icon: Network, answers: "overall shape, who clusters with whom" },
  { id: "force2d", label: "2D force", icon: Share2, answers: "precise reading, printing, screenshots" },
  { id: "ego", label: "Ego network", icon: Boxes, answers: "what one node is directly attached to" },
  { id: "matrix", label: "Adjacency matrix", icon: Grid3x3, answers: "dense subgraphs, where force turns to hairball" },
  { id: "dag", label: "Evidence DAG", icon: Sigma, answers: "why two personas are linked" },
  { id: "temporal", label: "Temporal", icon: Waypoints, answers: "how the network formed over time" },
  { id: "bipartite", label: "Persona ↔ identifier", icon: Layers, answers: "which identifier carries the link" },
  { id: "sankey", label: "Value flow", icon: Layers, answers: "where value moves" },
  { id: "community", label: "Communities", icon: Boxes, answers: "how the graph partitions" },
  { id: "diff", label: "Comparison diff", icon: GitCompare, answers: "what two actors share" },
  { id: "list", label: "Linkage list", icon: List, answers: "every edge, as text (the fallback)" },
];

const CAPTIONS: Record<Exclude<ViewId, "force3d">, string> = {
  force2d: FORCE2D_CAPTION,
  ego: EGO_CAPTION,
  matrix: MATRIX_CAPTION,
  dag: DAG_CAPTION,
  temporal: TEMPORAL_CAPTION,
  bipartite: BIPARTITE_CAPTION,
  sankey: SANKEY_CAPTION,
  community: COMMUNITY_CAPTION,
  diff: DIFF_CAPTION,
  list: LIST_CAPTION,
};

const FORCE3D_CAPTION =
  "The existing three-dimensional force layout, unchanged, now with the whole page. Colour is the entity type, size is importance, edge thickness is evidence strength. Layout position is a consequence of edge strength — distance is meaningful, absolute position is not.";

const LEGEND = [
  { color: ENTITY_COLOR.actor, label: "Actor / PGP" },
  { color: ENTITY_COLOR.persona, label: "Persona" },
  { color: ENTITY_COLOR.wallet, label: "Wallet" },
  { color: ENTITY_COLOR.email, label: "Email" },
  { color: ENTITY_COLOR.infra, label: "Infrastructure" },
];

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5">
      <p className="mono mb-1 text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">{label}</p>
      {children}
    </div>
  );
}

export default function GraphLab({
  profile, onOpenPair,
}: { profile: ActorProfile; onOpenPair: (pairId: string) => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const stageRef = useRef<HTMLDivElement>(null);

  const view = (params.get("view") as ViewId | null) ?? "force3d";
  const selected = params.get("node");
  const hops = Number(params.get("hops") ?? 1) || 1;
  const asOf = params.get("asOf");
  const diffWith = params.get("diff");

  const filters: GraphFilters = useMemo(
    () => ({
      roots: (params.get("roots")?.split(",").filter(Boolean) ?? []) as GraphFilters["roots"],
      minStrength: Number(params.get("min") ?? 0) || 0,
      showInferred: params.get("inferred") !== "0",
      showWeakLinkages: params.get("weak") !== "0",
      query: params.get("q") ?? "",
    }),
    [params]
  );

  const layoutParams: LayoutParams = useMemo(
    () => ({
      charge: Number(params.get("charge") ?? DEFAULT_LAYOUT.charge) || DEFAULT_LAYOUT.charge,
      linkDistance: Number(params.get("dist") ?? DEFAULT_LAYOUT.linkDistance) || DEFAULT_LAYOUT.linkDistance,
      iterations: Number(params.get("iter") ?? DEFAULT_LAYOUT.iterations) || DEFAULT_LAYOUT.iterations,
    }),
    [params]
  );

  const [pinned, setPinned] = useState<Record<string, { x: number; y: number }>>({});
  const [size, setSize] = useState({ width: 900, height: 560 });
  const [pair, setPair] = useState<PairScore | null>(null);
  const [fusionModel, setFusionModel] = useState<FusionModel | null>(null);
  const [clusters, setClusters] = useState<ClusterResult | null>(null);
  const [diffProfile, setDiffProfile] = useState<ActorProfile | null>(null);
  const [engineVersion, setEngineVersion] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const model = useMemo(() => buildModel(profile), [profile]);
  const filtered = useMemo(() => applyFilters(model, filters), [model, filters]);
  const dates = useMemo(() => timelineDates(model), [model]);
  const diffModel = useMemo(() => (diffProfile ? buildModel(diffProfile) : null), [diffProfile]);

  const setParam = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      router.replace(`?${next.toString()}`, { scroll: false });
    },
    [params, router]
  );

  // Measure the stage so the layouts fill it, rather than guessing a size.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize({ width: Math.max(320, r.width), height: Math.max(280, r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const m = await api.model();
      if (alive && "ok" in m && m.ok) setFusionModel(m as FusionModel);
      const v = await api.version();
      if (alive && "version" in v) setEngineVersion(`${v.service} ${v.version}`);
    })();
    return () => { alive = false; };
  }, []);

  // Load only what the current view needs; a view nobody opened should not cost
  // a request on a 512 MB free instance.
  useEffect(() => {
    if (view !== "sankey" || clusters) return;
    let alive = true;
    (async () => {
      const c = await api.clusters();
      if (alive) setClusters("ok" in c && c.ok ? (c as ClusterResult) : ({ ok: false, count: 0, clusters: [], co_spent_edges: 0 } as ClusterResult));
    })();
    return () => { alive = false; };
  }, [view, clusters]);

  useEffect(() => {
    if (!diffWith) { setDiffProfile(null); return; }
    let alive = true;
    (async () => {
      const d = await api.actor(diffWith);
      if (alive && "ok" in d && d.ok) setDiffProfile(d as ActorProfile);
    })();
    return () => { alive = false; };
  }, [diffWith]);

  // The evidence DAG reads a real pair; selecting a linkage anywhere feeds it.
  const openPairInDag = useCallback(
    async (pairId: string) => {
      setParam({ view: "dag", pair: pairId });
      const p = await api.pair(pairId);
      if ("ok" in p && p.ok) setPair(p as PairScore);
      else setPair(null);
    },
    [setParam]
  );

  useEffect(() => {
    const pid = params.get("pair");
    if (!pid || pair?.pair_id === pid) return;
    let alive = true;
    (async () => {
      const p = await api.pair(pid);
      if (alive) setPair("ok" in p && p.ok ? (p as PairScore) : null);
    })();
    return () => { alive = false; };
  }, [params, pair?.pair_id]);

  /**
   * Performance guard (DEC-057).
   *
   * Above the limit a force layout is an unreadable hairball AND an O(n^2)
   * layout on a mid-range laptop. Degrade to the matrix and SAY SO -- silently
   * rendering something else would be the tool lying about which view you asked
   * for.
   */
  const tooBig = filtered.nodes.length > HAIRBALL_LIMIT;
  const forceViews: ViewId[] = ["force3d", "force2d", "ego", "temporal", "community", "diff"];
  const effectiveView: ViewId = tooBig && forceViews.includes(view) ? "matrix" : view;

  // Reduced motion / no WebGL falls back to the complete linkage list. The
  // information always survives (INV-11).
  const [canRender3d, setCanRender3d] = useState(true);
  useEffect(() => {
    if (prefersReducedMotion()) { setCanRender3d(false); return; }
    try {
      const c = document.createElement("canvas");
      setCanRender3d(Boolean(c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch {
      setCanRender3d(false);
    }
  }, []);
  const finalView: ViewId =
    effectiveView === "force3d" && !canRender3d ? "list" : effectiveView;

  const viewProps: ViewProps = {
    model,
    filters,
    width: size.width,
    height: size.height,
    selected,
    onSelect: (id) => setParam({ node: id }),
    onOpenPair: (pid) => void openPairInDag(pid),
    pinned,
    onPin: (id, at) =>
      setPinned((prev) => {
        const next = { ...prev };
        if (at) next[id] = at;
        else delete next[id];
        return next;
      }),
    layoutParams,
    pair,
    clusters,
    hops,
    asOf,
    diffModel,
  };

  const provenance = provenanceOf(filtered, finalView, filters, engineVersion);

  async function doExport(kind: "png" | "svg" | "json" | "graphml") {
    try {
      if (kind === "json") {
        download(exportName(provenance, "json"), toJSON(filtered, provenance), "application/json");
      } else if (kind === "graphml") {
        download(exportName(provenance, "graphml"), toGraphML(filtered, provenance), "application/xml");
      } else {
        const svg = stageRef.current?.querySelector("svg");
        if (!svg) {
          setNote("This view has no vector drawing to export. Use JSON or GraphML, or switch to a 2D view.");
          return;
        }
        const text = toSVG(svg as SVGSVGElement, provenance);
        if (kind === "svg") download(exportName(provenance, "svg"), text, "image/svg+xml");
        else download(exportName(provenance, "png"), await toPNG(text, size.width, size.height), "image/png");
      }
      setNote(`Exported with provenance: ${provenanceLine(provenance)}`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Export failed.");
    }
  }

  const Body = () => {
    switch (finalView) {
      case "force3d":
        // The existing panel, mounted unchanged.
        return <ActorGraphPanel profile={profile} onOpenPair={(pid) => void openPairInDag(pid)} fill />;
      case "force2d": return <Force2D {...viewProps} />;
      case "ego": return <Ego {...viewProps} />;
      case "matrix": return <Matrix {...viewProps} />;
      case "dag": return <EvidenceDag {...viewProps} />;
      case "temporal": return <Temporal {...viewProps} />;
      case "bipartite": return <Bipartite {...viewProps} />;
      case "sankey": return <Sankey {...viewProps} />;
      case "community": return <Community {...viewProps} />;
      case "diff": return <Diff {...viewProps} />;
      case "list": return <LinkageList {...viewProps} />;
    }
  };

  return (
    <div className="flex h-[calc(100vh-96px)] min-h-[520px] gap-3">
      {/* ---- control column ------------------------------------------- */}
      <aside className="glass slim w-[220px] shrink-0 overflow-y-auto p-3" aria-label="Graph controls">
        <Control label="View">
          <ul className="space-y-0.5">
            {VIEWS.map((v) => (
              <li key={v.id}>
                <button
                  onClick={() => setParam({ view: v.id })}
                  aria-pressed={view === v.id}
                  title={v.answers}
                  className={`mono flex w-full items-center gap-1.5 rounded-[var(--radius)] px-1.5 py-1 text-left text-[9.5px] transition ${
                    view === v.id
                      ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--c-high)]"
                      : "text-[var(--muted-2)] hover:text-[var(--muted)]"
                  }`}
                >
                  <v.icon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{v.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </Control>

        <Control label="Signal root">
          <div className="flex flex-wrap gap-1">
            {SIGNAL_ROOTS.map((r) => {
              const on = filters.roots.includes(r);
              return (
                <button
                  key={r}
                  aria-pressed={on}
                  onClick={() => {
                    const next = on ? filters.roots.filter((x) => x !== r) : [...filters.roots, r];
                    setParam({ roots: next.join(",") || null });
                  }}
                  className={`mono flex items-center gap-1 border px-1.5 py-0.5 text-[8.5px] transition ${
                    on ? "border-[var(--accent)] text-[var(--c-high)]" : "border-[var(--border)] text-[var(--muted-2)]"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: `var(${signalVar(r)})` }}
                  />
                  {SIGNAL_LABEL[r]}
                </button>
              );
            })}
          </div>
        </Control>

        <Control label={`Minimum edge strength · ${filters.minStrength.toFixed(2)}`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={filters.minStrength}
            onChange={(e) => setParam({ min: e.target.value === "0" ? null : e.target.value })}
            aria-label="Minimum edge strength"
            className="w-full"
          />
          {/* The caveat is part of the control, not buried in docs. */}
          <p className="mono mt-1 text-[8px] leading-relaxed text-[var(--muted-2)]">
            τ was calibrated on 1,336 validation pairs, so its resolution is coarse. Treat this slider
            as a rough sieve — it does not carry finer precision than the data supports.
          </p>
        </Control>

        <Control label="Show">
          {[
            ["inferred", filters.showInferred, "Inferred nodes"],
            ["weak", filters.showWeakLinkages, "Linkages below 0.75"],
          ].map(([key, on, label]) => (
            <label key={String(key)} className="mono flex items-center gap-1.5 py-0.5 text-[9px] text-[var(--muted)]">
              <input
                type="checkbox"
                checked={Boolean(on)}
                onChange={(e) => setParam({ [String(key)]: e.target.checked ? null : "0" })}
              />
              {String(label)}
            </label>
          ))}
        </Control>

        <Control label="Highlight">
          <input
            value={filters.query}
            onChange={(e) => setParam({ q: e.target.value || null })}
            placeholder="handle, key, host"
            aria-label="Highlight nodes"
            className="mono w-full border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-1 text-[9.5px] text-[var(--text)] outline-none focus:border-[var(--accent-dim)]"
          />
          <p className="mono mt-1 text-[8px] text-[var(--muted-2)]">
            Highlights, never hides — a filtered-out node you did not intend to remove is a fact you
            did not see.
          </p>
        </Control>

        {finalView === "ego" && (
          <Control label={`Hops · ${hops}`}>
            <div className="flex gap-1">
              {[1, 2, 3].map((h) => (
                <button
                  key={h}
                  aria-pressed={hops === h}
                  onClick={() => setParam({ hops: String(h) })}
                  className={`mono flex-1 border px-1.5 py-1 text-[9px] transition ${
                    hops === h ? "border-[var(--accent)] text-[var(--c-high)]" : "border-[var(--border)] text-[var(--muted-2)]"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </Control>
        )}

        {finalView === "temporal" && dates.length > 0 && (
          <Control label={`As of · ${asOf ?? dates[dates.length - 1]}`}>
            <input
              type="range"
              min={0}
              max={dates.length - 1}
              value={Math.max(0, dates.indexOf(asOf ?? dates[dates.length - 1]))}
              onChange={(e) => setParam({ asOf: dates[Number(e.target.value)] })}
              aria-label="Timeline scrubber"
              className="w-full"
            />
            <p className="mono mt-1 text-[8px] text-[var(--muted-2)]">
              {dates.length} distinct first-evidence dates.
            </p>
          </Control>
        )}

        {finalView === "diff" && (
          <Control label="Diff against">
            <input
              value={diffWith ?? ""}
              onChange={(e) => setParam({ diff: e.target.value || null })}
              placeholder="actor-001"
              aria-label="Second actor id"
              className="mono w-full border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-1 text-[9.5px] text-[var(--text)] outline-none focus:border-[var(--accent-dim)]"
            />
          </Control>
        )}

        <Control label="Layout">
          {([
            ["charge", "Charge", -600, -40, 20, layoutParams.charge],
            ["dist", "Link distance", 20, 160, 4, layoutParams.linkDistance],
            ["iter", "Iterations", 60, 600, 20, layoutParams.iterations],
          ] as const).map(([key, label, min, max, step, value]) => (
            <label key={key} className="mono mb-1 block text-[8.5px] text-[var(--muted-2)]">
              {label} · {value}
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => setParam({ [key]: e.target.value })}
                className="w-full"
              />
            </label>
          ))}
          <button
            onClick={() => {
              setParam({ charge: null, dist: null, iter: null });
              setPinned({});
            }}
            className="mono mt-1 flex w-full items-center justify-center gap-1 border border-[var(--border-2)] py-1 text-[8.5px] uppercase tracking-[0.1em] text-[var(--muted)] transition hover:text-[var(--text)]"
          >
            <RotateCcw className="h-2.5 w-2.5" /> Reset layout and pins
          </button>
        </Control>

        <Control label="Export">
          <div className="grid grid-cols-2 gap-1">
            {(["png", "svg", "json", "graphml"] as const).map((k) => (
              <button
                key={k}
                onClick={() => void doExport(k)}
                className="mono flex items-center justify-center gap-1 border border-[var(--border-2)] py-1 text-[8.5px] uppercase tracking-[0.1em] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)]"
              >
                <Download className="h-2.5 w-2.5" />
                {k}
              </button>
            ))}
          </div>
          <p className="mono mt-1 text-[8px] leading-relaxed text-[var(--muted-2)]">
            Every export carries the actor, the filter state, the timestamp and the engine version. An
            exhibit with no provenance is not an exhibit.
          </p>
        </Control>
      </aside>

      {/* ---- stage ------------------------------------------------------ */}
      <section className="glass flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="hairline flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-1.5">
          <p className="mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">
            {VIEWS.find((v) => v.id === finalView)?.label}
            <span className="ml-2 normal-case tracking-normal text-[var(--muted-2)]">
              {filtered.nodes.length} nodes · {filtered.edges.length} edges
            </span>
          </p>
          <ul className="flex flex-wrap items-center gap-2">
            {LEGEND.map((l) => (
              <li key={l.label} className="mono flex items-center gap-1 text-[8.5px] text-[var(--muted-2)]">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: l.color }} />
                {l.label}
              </li>
            ))}
          </ul>
        </div>

        {finalView !== view && (
          <p
            data-testid="degraded-notice"
            className="mono shrink-0 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-3 py-1.5 text-[9px] text-[var(--muted)]"
          >
            {tooBig
              ? `${filtered.nodes.length} nodes is past the ${HAIRBALL_LIMIT}-node budget for a force layout, so the adjacency matrix is shown instead. Filter down to return to ${VIEWS.find((v) => v.id === view)?.label}.`
              : "No WebGL, or reduced motion is on, so the complete linkage list is shown instead of the 3D view. Every edge is present."}
          </p>
        )}

        <div ref={stageRef} className="min-h-0 flex-1 overflow-hidden">
          <Body />
        </div>

        <Caption>{finalView === "force3d" ? FORCE3D_CAPTION : CAPTIONS[finalView]}</Caption>

        {note && (
          <p role="status" className="mono shrink-0 border-t border-[var(--border)] px-3 py-1.5 text-[8.5px] text-[var(--muted-2)]">
            {note}
          </p>
        )}
      </section>

      {/* ---- inspector -------------------------------------------------- */}
      <aside className="glass w-[300px] shrink-0 overflow-hidden" aria-label="Node inspector">
        <NodeInspector
          model={filtered}
          profile={profile}
          selected={selected}
          fusionModel={fusionModel}
          pair={pair}
          onOpenPair={(pid) => void openPairInDag(pid)}
          onSelect={(id) => setParam({ node: id })}
        />
      </aside>
    </div>
  );
}
