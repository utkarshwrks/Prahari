"use client";

import { useMemo } from "react";
import {
  NODE_COLOR, applyFilters, components, degreeOf, edgesAsOf, egoNetwork, evidenceDag,
  layout2d, matches, type DagLevel, type GEdge, type GraphFilters, type GraphModel,
  type Positioned,
} from "@/lib/graphModel";
import { SIGNAL_LABEL, signalVar, type SignalRoot } from "@/lib/signals";
import type { PairScore, ClusterResult } from "@/lib/api";

/**
 * The graph kinds (DEC-057).
 *
 * Every view is a pure renderer over the shared model in `lib/graphModel.ts`.
 * Each one states, in a caption, WHAT ITS LAYOUT MEANS -- because a picture of
 * a network implies a claim, and an unlabelled picture implies whichever claim
 * the viewer already believed. The captions are not help text; they are the
 * honesty surface of this page.
 *
 * The 3D force view is not here: it stays in `ActorGraphPanel`/`ActorGraph3D`,
 * untouched, and the lab wraps it (the prime directive, and Phase 3 objective 1).
 */

export interface ViewProps {
  model: GraphModel;
  filters: GraphFilters;
  width: number;
  height: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onOpenPair: (pairId: string) => void;
  pinned: Record<string, { x: number; y: number }>;
  onPin: (id: string, at: { x: number; y: number } | null) => void;
  layoutParams: { charge: number; linkDistance: number; iterations: number };
  /** Extra data some views need; absent means the view says so rather than guessing. */
  pair?: PairScore | null;
  clusters?: ClusterResult | null;
  community?: { source: string; groups: Record<string, number> } | null;
  hops?: number;
  asOf?: string | null;
  diffModel?: GraphModel | null;
}

const edgeColor = (e: GEdge) =>
  e.root ? `var(${signalVar(e.root)})` : "color-mix(in srgb, var(--text) 22%, transparent)";

export function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p
      data-testid="view-caption"
      className="mono border-t border-[var(--border)] px-3 py-2 text-[9px] leading-relaxed text-[var(--muted-2)]"
    >
      {children}
    </p>
  );
}

function Empty({ reason }: { reason: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <p className="mono max-w-[46ch] text-center text-[10px] leading-relaxed text-[var(--muted-2)]">
        {reason}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared SVG node-link renderer, used by 2D force, ego and diff.
// ---------------------------------------------------------------------------

function NodeLink({
  model, positions, filters, selected, onSelect, onOpenPair, onPin, width, height, dim,
}: {
  model: GraphModel;
  positions: Positioned[];
  filters: GraphFilters;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onOpenPair: (pairId: string) => void;
  onPin: (id: string, at: { x: number; y: number } | null) => void;
  width: number;
  height: number;
  /** Node ids to draw muted (the diff view uses this for "not shared"). */
  dim?: Set<string>;
}) {
  const at = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions]);
  const neighbours = useMemo(() => {
    if (!selected) return null;
    const s = new Set<string>([selected]);
    for (const e of model.edges) {
      if (e.source === selected) s.add(e.target);
      if (e.target === selected) s.add(e.source);
    }
    return s;
  }, [selected, model.edges]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Relationship graph for ${model.label}: ${model.nodes.length} nodes, ${model.edges.length} edges`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelect(null);
      }}
      className="block"
    >
      <g>
        {model.edges.map((e) => {
          const a = at.get(e.source);
          const b = at.get(e.target);
          if (!a || !b) return null;
          const faded = neighbours && !(neighbours.has(e.source) && neighbours.has(e.target));
          return (
            <line
              key={e.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={edgeColor(e)}
              strokeWidth={0.6 + e.strength * 2.6}
              strokeOpacity={faded ? 0.1 : 0.55}
              style={e.pairId ? { cursor: "pointer" } : undefined}
              onClick={() => e.pairId && onOpenPair(e.pairId)}
            >
              <title>
                {e.kind}
                {e.root ? ` · ${SIGNAL_LABEL[e.root]}` : ""} · strength {e.strength.toFixed(2)}
              </title>
            </line>
          );
        })}
      </g>
      <g>
        {positions.map((n) => {
          const hit = matches(n, filters.query);
          const faded = (neighbours && !neighbours.has(n.id)) || dim?.has(n.id);
          const r = 4 + n.size * 16;
          return (
            <g key={n.id} transform={`translate(${n.x},${n.y})`}>
              <circle
                r={r}
                fill={NODE_COLOR(n.kind)}
                fillOpacity={faded ? 0.18 : 0.92}
                stroke={
                  n.id === selected
                    ? "var(--text)"
                    : hit
                      ? "var(--accent)"
                      : n.pinned
                        ? "var(--muted)"
                        : "none"
                }
                strokeWidth={n.id === selected || hit ? 2 : n.pinned ? 1.5 : 0}
                strokeDasharray={n.inferred ? "3 2" : undefined}
                style={{ cursor: "pointer" }}
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelect(n.id === selected ? null : n.id);
                }}
                onDoubleClick={(ev) => {
                  ev.stopPropagation();
                  onPin(n.id, n.pinned ? null : { x: n.x, y: n.y });
                }}
              >
                <title>
                  {n.label} · {n.kind}
                  {n.inferred ? " · inferred" : ""}
                </title>
              </circle>
              {(n.size > 0.2 || n.id === selected || hit) && (
                <text
                  x={r + 4}
                  y={3.5}
                  fontSize={9}
                  fill={faded ? "var(--muted-2)" : "var(--muted)"}
                  className="mono"
                  style={{ pointerEvents: "none" }}
                >
                  {n.label}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 1. 2D force
// ---------------------------------------------------------------------------

export function Force2D(p: ViewProps) {
  const m = useMemo(() => applyFilters(p.model, p.filters), [p.model, p.filters]);
  const positions = useMemo(
    () => layout2d(m, p.width, p.height, p.layoutParams, p.pinned),
    [m, p.width, p.height, p.layoutParams, p.pinned]
  );
  if (!m.edges.length) return <Empty reason="No edges survive the current filters." />;
  return (
    <NodeLink
      model={m}
      positions={positions}
      filters={p.filters}
      selected={p.selected}
      onSelect={p.onSelect}
      onOpenPair={p.onOpenPair}
      onPin={p.onPin}
      width={p.width}
      height={p.height}
    />
  );
}

export const FORCE2D_CAPTION =
  "Force-directed in two dimensions, from a fixed seed: the same actor lays out identically every time, so a screenshot in a report can be reproduced. Layout position is a consequence of edge strength — distance is meaningful, absolute position is not. Double-click a node to pin it.";

// ---------------------------------------------------------------------------
// 2. Ego network
// ---------------------------------------------------------------------------

export function Ego(p: ViewProps) {
  const centre = p.selected ?? p.model.actorId;
  const m = useMemo(
    () => egoNetwork(applyFilters(p.model, p.filters), centre, p.hops ?? 1),
    [p.model, p.filters, centre, p.hops]
  );
  const positions = useMemo(
    () => layout2d(m, p.width, p.height, p.layoutParams, p.pinned),
    [m, p.width, p.height, p.layoutParams, p.pinned]
  );
  if (m.nodes.length <= 1) {
    return <Empty reason="Nothing is attached to this node within the selected number of hops." />;
  }
  return (
    <NodeLink
      model={m}
      positions={positions}
      filters={p.filters}
      selected={p.selected}
      onSelect={p.onSelect}
      onOpenPair={p.onOpenPair}
      onPin={p.onPin}
      width={p.width}
      height={p.height}
    />
  );
}

export const EGO_CAPTION =
  "Everything within N hops of one node, and nothing else. Answers what a single entity is directly attached to, without the rest of the network arguing for attention. Select a node to re-centre.";

// ---------------------------------------------------------------------------
// 3. Adjacency matrix
// ---------------------------------------------------------------------------

export function Matrix(p: ViewProps) {
  const m = useMemo(() => applyFilters(p.model, p.filters), [p.model, p.filters]);
  const order = useMemo(() => {
    const deg = degreeOf(m);
    const comp = components(m);
    // Cluster first, then degree: a matrix ordered arbitrarily shows nothing,
    // and this ordering is what makes dense blocks visible at all.
    return [...m.nodes].sort(
      (a, b) => (comp[a.id] ?? 0) - (comp[b.id] ?? 0) || (deg[b.id] ?? 0) - (deg[a.id] ?? 0)
    );
  }, [m]);

  const cell = useMemo(() => {
    const map = new Map<string, GEdge>();
    for (const e of m.edges) {
      map.set(`${e.source}|${e.target}`, e);
      map.set(`${e.target}|${e.source}`, e);
    }
    return map;
  }, [m.edges]);

  if (!order.length) return <Empty reason="No nodes survive the current filters." />;

  const size = Math.max(6, Math.min(18, Math.floor((p.height - 120) / order.length)));

  return (
    <div className="slim h-full overflow-auto p-3">
      <table className="border-collapse" style={{ fontSize: 8 }}>
        <thead>
          <tr>
            <th />
            {order.map((n) => (
              <th
                key={n.id}
                className="mono"
                style={{ width: size, height: 84, verticalAlign: "bottom", padding: 0 }}
              >
                <div
                  className="truncate text-[var(--muted-2)]"
                  style={{ writingMode: "vertical-rl", maxHeight: 80, transform: "rotate(180deg)" }}
                >
                  {n.label}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {order.map((row) => (
            <tr key={row.id}>
              <th
                scope="row"
                className="mono max-w-[16ch] truncate pr-1.5 text-right text-[var(--muted-2)]"
                style={{ fontWeight: 400 }}
              >
                {row.label}
              </th>
              {order.map((col) => {
                const e = row.id === col.id ? undefined : cell.get(`${row.id}|${col.id}`);
                return (
                  <td key={col.id} style={{ width: size, height: size, padding: 0 }}>
                    <div
                      title={
                        e
                          ? `${row.label} ↔ ${col.label} · ${e.kind} · ${e.strength.toFixed(2)}`
                          : undefined
                      }
                      onClick={() => e?.pairId && p.onOpenPair(e.pairId)}
                      style={{
                        width: size - 1,
                        height: size - 1,
                        background: e
                          ? e.root
                            ? `var(${signalVar(e.root)})`
                            : "var(--muted-2)"
                          : row.id === col.id
                            ? "color-mix(in srgb, var(--text) 10%, transparent)"
                            : "transparent",
                        opacity: e ? 0.25 + e.strength * 0.75 : 1,
                        cursor: e?.pairId ? "pointer" : "default",
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const MATRIX_CAPTION =
  "Every pair, as a grid. Rows and columns are ordered by connected component then by degree, so dense blocks sit together — this is the view that stays readable where a force layout turns to hairball. Cell opacity is edge strength; cell colour is the signal root.";

// ---------------------------------------------------------------------------
// 4. Evidence DAG — the courtroom view
// ---------------------------------------------------------------------------

export function EvidenceDag(p: ViewProps) {
  if (!p.pair) {
    return (
      <Empty reason="Select a persona-to-persona linkage — in any other view, or from the dossier — to see the arithmetic that produced it. This view reads /fusion/pair and shows nothing without one." />
    );
  }
  const levels: DagLevel[] = evidenceDag(p.pair);
  return (
    <div className="slim h-full overflow-auto p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {levels.map((lv) => (
          <section key={lv.title} className="border border-[var(--border)] bg-[var(--surface-2)] p-2.5">
            <h3 className="mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">
              {lv.title}
            </h3>
            <p className="mono mt-1 text-[8.5px] leading-relaxed text-[var(--muted-2)]">{lv.caption}</p>
            <ul className="mt-2 space-y-1">
              {lv.items.length === 0 && (
                <li className="mono text-[9px] text-[var(--muted-2)]">None recorded.</li>
              )}
              {lv.items.map((it) => (
                <li
                  key={it.id}
                  data-discarded={it.muted ? "true" : undefined}
                  className="mono flex items-center justify-between gap-2 border-b border-[var(--border)] py-1 text-[9.5px] last:border-0"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {it.root && (
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: `var(${signalVar(it.root)})` }}
                      />
                    )}
                    <span
                      className={`truncate ${it.muted ? "text-[var(--muted-2)] line-through" : "text-[var(--text)]"}`}
                    >
                      {it.label}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-[var(--muted-2)]">{it.value}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export const DAG_CAPTION =
  "Why two personas are linked, left to right: raw signals, grouped into root causes, collapsed so one fact is not counted twice, then dampened by reliability and multiplied against the prior. Discarded signals are struck through and still named — the collapse is the most contestable step in the model, so it is shown rather than summarised.";

// ---------------------------------------------------------------------------
// 5. Temporal
// ---------------------------------------------------------------------------

export function Temporal(p: ViewProps) {
  const base = useMemo(() => applyFilters(p.model, p.filters), [p.model, p.filters]);
  const m = useMemo(
    () => ({ ...base, edges: edgesAsOf(base, p.asOf ?? null) }),
    [base, p.asOf]
  );
  const positions = useMemo(
    // Positions come from the FULL model, so nodes do not jump as the scrubber
    // moves -- only edges appear. A layout that reflowed each step would make
    // the animation about the layout rather than about the evidence.
    () => layout2d(base, p.width, p.height, p.layoutParams, p.pinned),
    [base, p.width, p.height, p.layoutParams, p.pinned]
  );
  return (
    <NodeLink
      model={m}
      positions={positions}
      filters={p.filters}
      selected={p.selected}
      onSelect={p.onSelect}
      onOpenPair={p.onOpenPair}
      onPin={p.onPin}
      width={p.width}
      height={p.height}
    />
  );
}

export const TEMPORAL_CAPTION =
  "The same layout, with edges revealed at the date their first evidence was seen. Node positions are fixed from the complete graph so nothing moves as you scrub — what changes is the evidence, not the drawing. A host appearing or going dark is exactly what an investigation turns on.";

// ---------------------------------------------------------------------------
// 6. Bipartite persona ↔ identifier
// ---------------------------------------------------------------------------

export function Bipartite(p: ViewProps) {
  const m = useMemo(() => applyFilters(p.model, p.filters), [p.model, p.filters]);
  const personas = m.nodes.filter((n) => n.kind === "persona");
  const idents = m.nodes.filter((n) => ["pgp", "wallet", "email", "onion", "infra"].includes(n.kind));
  if (!personas.length || !idents.length) {
    return <Empty reason="This actor has no persona-to-identifier edges under the current filters." />;
  }

  const gapL = 150;
  const gapR = p.width - 150;
  const yl = (i: number) => ((i + 1) * p.height) / (personas.length + 1);
  const yr = (i: number) => ((i + 1) * p.height) / (idents.length + 1);
  const li = new Map(personas.map((n, i) => [n.id, yl(i)]));
  const ri = new Map(idents.map((n, i) => [n.id, yr(i)]));

  return (
    <svg width={p.width} height={p.height} role="img" aria-label="Persona to identifier bipartite graph">
      {m.edges.map((e) => {
        const a = li.get(e.source) ?? li.get(e.target);
        const b = ri.get(e.target) ?? ri.get(e.source);
        if (a === undefined || b === undefined) return null;
        return (
          <path
            key={e.id}
            d={`M ${gapL} ${a} C ${(gapL + gapR) / 2} ${a}, ${(gapL + gapR) / 2} ${b}, ${gapR} ${b}`}
            fill="none"
            stroke={edgeColor(e)}
            strokeWidth={0.6 + e.strength * 2.4}
            strokeOpacity={0.5}
          >
            <title>{`${e.kind} · strength ${e.strength.toFixed(2)}`}</title>
          </path>
        );
      })}
      {personas.map((n, i) => (
        <g key={n.id} transform={`translate(${gapL},${yl(i)})`} onClick={() => p.onSelect(n.id)}>
          <circle r={6} fill={NODE_COLOR(n.kind)} style={{ cursor: "pointer" }} />
          <text x={-10} y={3.5} fontSize={9} textAnchor="end" fill="var(--muted)" className="mono">
            {n.label}
          </text>
        </g>
      ))}
      {idents.map((n, i) => (
        <g key={n.id} transform={`translate(${gapR},${yr(i)})`} onClick={() => p.onSelect(n.id)}>
          <circle
            r={5}
            fill={NODE_COLOR(n.kind)}
            strokeDasharray={n.inferred ? "3 2" : undefined}
            stroke={n.inferred ? "var(--muted)" : "none"}
            style={{ cursor: "pointer" }}
          />
          <text x={10} y={3.5} fontSize={9} fill="var(--muted)" className="mono">
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export const BIPARTITE_CAPTION =
  "Personas on the left, the identifiers and hosts they touch on the right. An identifier with several ribbons running into it is the thing that carries the link — this view answers which identifier did the work, which a force layout buries.";

// ---------------------------------------------------------------------------
// 7. Sankey / value flow
// ---------------------------------------------------------------------------

export function Sankey(p: ViewProps) {
  const clusters = p.clusters?.clusters ?? [];
  if (!p.clusters) return <Empty reason="Loading wallet clusters from the engine…" />;
  if (!clusters.length) {
    return <Empty reason="The engine returned no wallet clusters for this dataset, so there is no value movement to draw." />;
  }

  const rows = clusters.slice(0, 12);
  const H = 26;
  const total = Math.max(1, ...rows.map((c) => c.tx_count));

  return (
    <div className="slim h-full overflow-auto p-3">
      <ul className="space-y-2">
        {rows.map((c) => (
          <li key={c.cluster_id} className="border border-[var(--border)] bg-[var(--surface-2)] p-2">
            <div className="mono flex items-center justify-between text-[9.5px]">
              <span className="truncate text-[var(--text)]">{c.cluster_id}</span>
              <span className="tnum text-[var(--muted-2)]">
                {c.addresses.length} addresses · {c.tx_count} tx · risk {c.risk}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="bar block h-[10px] flex-1">
                <span
                  style={{
                    width: `${(c.tx_count / total) * 100}%`,
                    background: `var(${signalVar("financial")})`,
                    height: H / 3,
                  }}
                />
              </span>
            </div>
            {c.reaches.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {c.reaches.map((r) => (
                  <li key={r.address} className="mono flex justify-between gap-2 text-[9px]">
                    <span className="truncate text-[var(--muted-2)]">{r.address}</span>
                    <span className="shrink-0 text-[var(--muted)]">
                      {r.label} · {r.kind}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export const SANKEY_CAPTION =
  "Value movement by wallet cluster, widest first, with the labelled services each cluster reaches. Bar width is transaction count, not amount — the engine clusters by co-spend and does not value the flows, and drawing a width from a number it does not have would be an invention.";

// ---------------------------------------------------------------------------
// 8. Community / cluster
// ---------------------------------------------------------------------------

export function Community(p: ViewProps) {
  const m = useMemo(() => applyFilters(p.model, p.filters), [p.model, p.filters]);
  const groups = p.community?.groups ?? components(m);
  const source = p.community?.source ?? "local weakly-connected components";
  const positions = useMemo(
    () => layout2d(m, p.width, p.height, p.layoutParams, p.pinned),
    [m, p.width, p.height, p.layoutParams, p.pinned]
  );
  const palette = [
    "var(--sig-identity)", "var(--sig-infra)", "var(--sig-financial)",
    "var(--sig-temporal)", "var(--sig-linguistic)", "var(--sig-social)",
  ];

  return (
    <div className="flex h-full flex-col">
      <p
        data-testid="community-source"
        className="mono shrink-0 px-3 pt-2 text-[9px] text-[var(--muted-2)]"
      >
        Partition from: <span className="text-[var(--text)]">{source}</span>
      </p>
      <svg width={p.width} height={p.height - 22} role="img" aria-label="Community partition">
        {m.edges.map((e) => {
          const a = positions.find((n) => n.id === e.source);
          const b = positions.find((n) => n.id === e.target);
          if (!a || !b) return null;
          const same = groups[e.source] === groups[e.target];
          return (
            <line
              key={e.id}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={same ? palette[(groups[e.source] ?? 0) % palette.length] : "var(--muted-2)"}
              strokeWidth={same ? 1.6 : 0.7}
              strokeOpacity={same ? 0.5 : 0.25}
              strokeDasharray={same ? undefined : "2 3"}
            />
          );
        })}
        {positions.map((n) => (
          <g key={n.id} transform={`translate(${n.x},${n.y})`} onClick={() => p.onSelect(n.id)}>
            <circle
              r={4 + n.size * 14}
              fill={palette[(groups[n.id] ?? 0) % palette.length]}
              fillOpacity={0.85}
              style={{ cursor: "pointer" }}
            >
              <title>{`${n.label} · group ${groups[n.id] ?? 0}`}</title>
            </circle>
          </g>
        ))}
      </svg>
    </div>
  );
}

export const COMMUNITY_CAPTION =
  "Nodes coloured by partition; dashed grey edges cross a boundary. The source of the partition is stated above the drawing, because Neo4j GDS Louvain and a local weakly-connected-components pass are different claims — WCC finds disconnected pieces, not communities, and calling one the other would overstate it.";

// ---------------------------------------------------------------------------
// 9. Comparison diff
// ---------------------------------------------------------------------------

export function Diff(p: ViewProps) {
  const m = useMemo(() => applyFilters(p.model, p.filters), [p.model, p.filters]);
  if (!p.diffModel) {
    return <Empty reason="Choose a second actor in the controls to diff against. Shared nodes are highlighted; everything else is muted." />;
  }
  const other = new Set(p.diffModel.nodes.map((n) => n.value));
  const shared = new Set(m.nodes.filter((n) => other.has(n.value)).map((n) => n.id));
  const dim = new Set(m.nodes.filter((n) => !shared.has(n.id)).map((n) => n.id));
  const positions = layout2d(m, p.width, p.height, p.layoutParams, p.pinned);

  return (
    <div className="flex h-full flex-col">
      <p className="mono shrink-0 px-3 pt-2 text-[9px] text-[var(--muted-2)]">
        {shared.size === 0
          ? `No node value appears in both ${m.label} and ${p.diffModel.label}.`
          : `${shared.size} node ${shared.size === 1 ? "value appears" : "values appear"} in both ${m.label} and ${p.diffModel.label}.`}
      </p>
      <NodeLink
        model={m}
        positions={positions}
        filters={p.filters}
        selected={p.selected}
        onSelect={p.onSelect}
        onOpenPair={p.onOpenPair}
        onPin={p.onPin}
        width={p.width}
        height={p.height - 22}
        dim={dim}
      />
    </div>
  );
}

export const DIFF_CAPTION =
  "This actor's graph, with every node whose value also appears in the second actor's graph drawn solid and the rest muted. Sharing an identifier is a fact; whether two actors are one operator is a fused judgement with a published false-merge rate, and this view does not make it.";

// ---------------------------------------------------------------------------
// 10. 2D linkage list — the fallback that must always survive
// ---------------------------------------------------------------------------

export function LinkageList(p: ViewProps) {
  const m = useMemo(() => applyFilters(p.model, p.filters), [p.model, p.filters]);
  return (
    <div className="slim h-full overflow-auto p-3">
      <p className="mono mb-2 text-[10px] text-[var(--muted)]">
        {m.nodes.length} nodes · {m.edges.length} edges. Every edge in the graph is listed below; none
        is summarised away.
      </p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="mono text-[8.5px] uppercase tracking-[0.14em] text-[var(--muted-2)]">
            <th scope="col" className="border-b border-[var(--border)] px-1.5 py-1 text-left">From</th>
            <th scope="col" className="border-b border-[var(--border)] px-1.5 py-1 text-left">To</th>
            <th scope="col" className="border-b border-[var(--border)] px-1.5 py-1 text-left">Kind</th>
            <th scope="col" className="border-b border-[var(--border)] px-1.5 py-1 text-left">Root</th>
            <th scope="col" className="border-b border-[var(--border)] px-1.5 py-1 text-right">Strength</th>
          </tr>
        </thead>
        <tbody data-testid="linkage-rows">
          {m.edges.map((e) => (
            <tr key={e.id} className="border-b border-[var(--border)] last:border-0">
              <td className="mono max-w-[20ch] truncate px-1.5 py-1 text-[9.5px] text-[var(--muted)]">
                {e.source}
              </td>
              <td className="mono max-w-[20ch] truncate px-1.5 py-1 text-[9.5px] text-[var(--muted)]">
                {e.target}
              </td>
              <td className="mono px-1.5 py-1 text-[9.5px] text-[var(--muted-2)]">
                {e.pairId ? (
                  <button
                    onClick={() => p.onOpenPair(e.pairId!)}
                    className="underline decoration-dotted underline-offset-2 hover:text-[var(--c-high)]"
                  >
                    {e.kind}
                  </button>
                ) : (
                  e.kind
                )}
              </td>
              <td className="mono px-1.5 py-1 text-[9.5px] text-[var(--muted-2)]">
                {e.root ? SIGNAL_LABEL[e.root] : "—"}
              </td>
              <td className="mono tnum px-1.5 py-1 text-right text-[9.5px] text-[var(--text)]">
                {e.strength.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const LIST_CAPTION =
  "Every edge as a table. This is the automatic fallback for reduced motion, no WebGL and screen readers, and it is complete: no edge is dropped, summarised or rounded away. The information always survives (INV-11).";
