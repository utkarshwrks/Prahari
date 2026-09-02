/**
 * ONE GRAPH MODEL, ELEVEN RENDERERS (DEC-057).
 *
 * The graph lab offers eleven representations of the same actor. They must all
 * be views of ONE model, not eleven builders that each walk the profile their
 * own way -- otherwise the matrix and the force layout can disagree about
 * whether an edge exists, and the analyst has no way to tell which is lying.
 *
 * `ActorGraph3D` keeps its own private builder because it works and the prime
 * directive says not to touch it. This model is a superset: it carries the same
 * nodes and edges plus the metadata the other ten views need (signal root,
 * first-evidence date, collapse status, provenance). `graphModel.test.ts`
 * asserts the two agree on node and edge counts, so they cannot drift.
 */
import type { ActorProfile, PairScore } from "./api";
import { ENTITY_COLOR, SIGNAL_LABEL, type EntityKind, type SignalRoot } from "./signals";

export type EdgeKind = "membership" | "identifier" | "shared identifier" | "infra pivot" | "linkage";

export interface GNode {
  id: string;
  label: string;
  /** Full value, unshortened -- the inspector shows the real thing. */
  value: string;
  kind: EntityKind;
  size: number;
  detail: string;
  /** Personas this node touches. Drives the bipartite and ego views. */
  personas: string[];
  /** True when the node is a derived/pivoted artefact rather than an observation. */
  inferred: boolean;
  /** Earliest date any evidence for this node was seen, if known. */
  firstSeen: string | null;
}

export interface GEdge {
  id: string;
  source: string;
  target: string;
  strength: number;
  kind: EdgeKind;
  /** The signal root this edge belongs to, where one applies. */
  root: SignalRoot | null;
  /** Present on persona-to-persona linkages, for the evidence trail. */
  pairId?: string;
  firstSeen: string | null;
}

export interface GraphModel {
  actorId: string;
  label: string;
  nodes: GNode[];
  edges: GEdge[];
}

const short = (v: string) => (v.length > 20 ? `${v.slice(0, 10)}…${v.slice(-6)}` : v);

/** Identifier kind → entity kind. Unknown kinds render as email-class contacts. */
function identKind(kind: string): EntityKind {
  return (["pgp", "wallet", "email", "onion"] as const).includes(kind as never)
    ? (kind as EntityKind)
    : "email";
}

/**
 * Which signal root an identifier belongs to.
 *
 * This mirrors the engine's own grouping (`fusion/score.py`). It is a mapping,
 * not a judgement: a PGP key is identity evidence, a wallet is financial, a
 * host is infrastructure. Anything unrecognised gets `null` rather than a
 * guess, and the filters treat null as "unclassified" instead of hiding it.
 */
export function rootForIdentifier(kind: string): SignalRoot | null {
  switch (kind) {
    case "pgp":
      return "identity_key";
    case "wallet":
      return "financial";
    case "email":
      return "identity_key";
    case "onion":
      return "infra";
    default:
      return null;
  }
}

export function buildModel(p: ActorProfile): GraphModel {
  const nodes: GNode[] = [
    {
      id: p.actor_id,
      label: p.label,
      value: p.actor_id,
      kind: "actor",
      size: 0.42,
      detail: `Resolved actor with ${p.personas.length} personas. Attribution confidence ${
        p.attribution_confidence?.toFixed(3) ?? "not measured"
      }.`,
      personas: p.personas.map((s) => s.id),
      inferred: false,
      firstSeen: p.first_seen,
    },
  ];
  const edges: GEdge[] = [];

  for (const s of p.personas) {
    nodes.push({
      id: s.id,
      label: s.handle,
      value: s.id,
      kind: "persona",
      size: 0.28,
      detail: `${s.handle} on ${s.market}. ${s.post_count} posts, ${s.first_seen?.slice(0, 10) ?? "?"} to ${s.last_seen?.slice(0, 10) ?? "?"}.`,
      personas: [s.id],
      inferred: false,
      firstSeen: s.first_seen,
    });
    edges.push({
      id: `m:${p.actor_id}:${s.id}`,
      source: p.actor_id,
      target: s.id,
      strength: 0.5,
      kind: "membership",
      root: null,
      firstSeen: s.first_seen,
    });
  }

  const firstSeenOf = (ids: string[]) => {
    const dates = p.personas.filter((s) => ids.includes(s.id)).map((s) => s.first_seen).filter(Boolean);
    return dates.length ? dates.sort()[0]! : null;
  };

  for (const i of p.identifiers) {
    const nid = `${i.kind}:${i.value}`;
    nodes.push({
      id: nid,
      label: short(i.value),
      value: i.value,
      kind: identKind(i.kind),
      size: i.shared ? 0.26 : 0.17,
      detail: i.shared
        ? `${i.kind.toUpperCase()} shared across ${i.personas.length} personas — a hard identifier that resolved this actor.`
        : `${i.kind.toUpperCase()} seen on one persona.`,
      personas: i.personas,
      inferred: false,
      firstSeen: firstSeenOf(i.personas),
    });
    for (const pid of i.personas) {
      edges.push({
        id: `i:${pid}:${nid}`,
        source: pid,
        target: nid,
        strength: i.shared ? 0.95 : 0.4,
        kind: i.shared ? "shared identifier" : "identifier",
        root: rootForIdentifier(i.kind),
        firstSeen: firstSeenOf([pid]),
      });
    }
  }

  for (const x of p.infrastructure) {
    const nid = `infra:${x.clearnet_host}`;
    nodes.push({
      id: nid,
      label: x.clearnet_host,
      value: x.clearnet_host,
      kind: "infra",
      size: 0.22,
      // Pivoted, not observed directly on the persona: an inferred node, and
      // the filters can hide it precisely because it is labelled as one.
      detail: `Clearnet host pivoted from the actor's onion at strength ${x.strength.toFixed(2)}.`,
      personas: p.personas.map((s) => s.id),
      inferred: true,
      firstSeen: p.first_seen,
    });
    for (const s of p.personas) {
      edges.push({
        id: `x:${s.id}:${nid}`,
        source: s.id,
        target: nid,
        strength: x.strength,
        kind: "infra pivot",
        root: "infra",
        firstSeen: s.first_seen,
      });
    }
  }

  for (const l of p.linkages) {
    edges.push({
      id: `l:${l.persona_a}:${l.persona_b}`,
      source: l.persona_a,
      target: l.persona_b,
      strength: l.confidence,
      kind: "linkage",
      // A linkage is fused from several roots; the strongest one names it.
      root: (l.roots[0] as SignalRoot) ?? null,
      pairId: `${l.persona_a}|${l.persona_b}`,
      firstSeen: firstSeenOf([l.persona_a, l.persona_b]),
    });
  }

  return { actorId: p.actor_id, label: p.label, nodes, edges };
}

// ---------------------------------------------------------------------------
// Filters. Every control in the left column resolves to one of these.
// ---------------------------------------------------------------------------

export interface GraphFilters {
  /** Signal roots to keep. Empty means all. */
  roots: SignalRoot[];
  /** Minimum edge strength. */
  minStrength: number;
  showInferred: boolean;
  showWeakLinkages: boolean;
  /** Free-text highlight; does not remove nodes, only marks them. */
  query: string;
}

export const DEFAULT_FILTERS: GraphFilters = {
  roots: [],
  minStrength: 0,
  showInferred: true,
  showWeakLinkages: true,
  query: "",
};

export function applyFilters(m: GraphModel, f: GraphFilters): GraphModel {
  let edges = m.edges.filter((e) => e.strength >= f.minStrength);
  if (f.roots.length) {
    // Structural edges (membership) are never filtered by root: hiding them
    // would disconnect the actor from its own personas and make the graph a lie
    // about the data rather than a subset of it.
    edges = edges.filter((e) => e.kind === "membership" || (e.root && f.roots.includes(e.root)));
  }
  if (!f.showWeakLinkages) edges = edges.filter((e) => e.kind !== "linkage" || e.strength >= 0.75);

  let nodes = m.nodes;
  if (!f.showInferred) nodes = nodes.filter((n) => !n.inferred);

  // Drop edges whose endpoints are gone, then drop nodes with no edges left --
  // except the actor, which stays so the view is never empty without saying why.
  const alive = new Set(nodes.map((n) => n.id));
  edges = edges.filter((e) => alive.has(e.source) && alive.has(e.target));
  const touched = new Set<string>([m.actorId]);
  for (const e of edges) {
    touched.add(e.source);
    touched.add(e.target);
  }
  nodes = nodes.filter((n) => touched.has(n.id));

  return { ...m, nodes, edges };
}

/** Nodes matching the highlight query. Highlight, never hide. */
export function matches(n: GNode, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return `${n.label} ${n.value} ${n.kind}`.toLowerCase().includes(q);
}

// ---------------------------------------------------------------------------
// Deterministic 2D layout.
//
// The same actor must lay out identically twice, or a screenshot in a report
// cannot be reproduced and two analysts comparing notes see different pictures.
// d3-force seeds from Math.random, so this uses its own seeded generator and a
// fixed iteration count instead of a decaying alpha.
// ---------------------------------------------------------------------------

/** mulberry32 — small, fast, and deterministic from a 32-bit seed. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash, so the seed comes from the actor id, not the clock. */
export function seedFor(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export interface LayoutParams {
  charge: number;
  linkDistance: number;
  iterations: number;
}

export const DEFAULT_LAYOUT: LayoutParams = { charge: -260, linkDistance: 64, iterations: 320 };

export interface Positioned extends GNode {
  x: number;
  y: number;
  pinned?: boolean;
}

/**
 * A deterministic force layout, computed synchronously.
 *
 * Hand-rolled rather than d3-force because d3 seeds its own initial positions
 * from `Math.random` and there is no supported way to inject a generator; the
 * determinism test is a hard requirement of this phase's gate, and "usually the
 * same" is not determinism.
 */
export function layout2d(
  m: GraphModel,
  width: number,
  height: number,
  params: LayoutParams = DEFAULT_LAYOUT,
  pinned: Record<string, { x: number; y: number }> = {}
): Positioned[] {
  const rnd = seededRandom(seedFor(m.actorId));
  const nodes: Positioned[] = m.nodes.map((n) => {
    const p = pinned[n.id];
    return {
      ...n,
      x: p ? p.x : (rnd() - 0.5) * width * 0.6 + width / 2,
      y: p ? p.y : (rnd() - 0.5) * height * 0.6 + height / 2,
      pinned: Boolean(p),
    };
  });
  const index = new Map(nodes.map((n) => [n.id, n]));

  for (let step = 0; step < params.iterations; step++) {
    // Cooling factor: large early moves, small late ones, no randomness.
    const cool = 1 - step / params.iterations;

    // Repulsion, O(n^2). The lab degrades above 800 nodes before this matters.
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) {
          // Coincident nodes: nudge along a deterministic axis, never randomly.
          dx = (i % 2 ? 1 : -1) * 0.5;
          dy = (j % 2 ? 1 : -1) * 0.5;
          d2 = 0.5;
        }
        const d = Math.sqrt(d2);
        const f = (params.charge / d2) * cool;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        if (!a.pinned) {
          a.x += fx;
          a.y += fy;
        }
        if (!b.pinned) {
          b.x -= fx;
          b.y -= fy;
        }
      }
    }

    // Spring along edges; stronger evidence pulls tighter, which is the whole
    // semantic claim the caption makes about distance.
    for (const e of m.edges) {
      const a = index.get(e.source);
      const b = index.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const target = params.linkDistance * (1.4 - e.strength * 0.6);
      const f = ((d - target) / d) * 0.5 * (0.1 + e.strength * 0.6) * cool;
      const fx = dx * f;
      const fy = dy * f;
      if (!a.pinned) {
        a.x += fx;
        a.y += fy;
      }
      if (!b.pinned) {
        b.x -= fx;
        b.y -= fy;
      }
    }

    // Weak centring, so the drawing does not drift out of frame.
    for (const n of nodes) {
      if (n.pinned) continue;
      n.x += (width / 2 - n.x) * 0.012 * cool;
      n.y += (height / 2 - n.y) * 0.012 * cool;
    }
  }

  /**
   * Fit the drawing to the stage.
   *
   * Without this the layout settles into a small cluster near the centre and
   * most of the panel is empty -- a graph of seven nodes drawn at thumbnail
   * size in a 900x800 stage, which wastes the room the whole phase exists to
   * provide. Clamping alone did not help: nothing was out of bounds, it was
   * simply too small.
   *
   * A UNIFORM scale plus a translation, computed from the settled positions.
   * Uniform is the important part: it preserves every ratio between distances,
   * so the caption's claim ("distance is meaningful, absolute position is not")
   * stays exactly as true after fitting as before. A non-uniform stretch would
   * make it false. Deterministic, because it is derived from deterministic
   * input.
   */
  const M = 40;
  const pins = Object.keys(pinned).length;
  if (nodes.length > 1 && pins === 0) {
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    // Never scale up past 3x: a two-node graph blown across the whole stage
    // reads as a much stronger separation than the data supports.
    const scale = Math.min((width - 2 * M) / spanX, (height - 2 * M) / spanY, 3);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    for (const n of nodes) {
      n.x = width / 2 + (n.x - cx) * scale;
      n.y = height / 2 + (n.y - cy) * scale;
    }
  }

  // Clamp into the viewport with a margin for the node radius and its label.
  for (const n of nodes) {
    n.x = Math.max(M, Math.min(width - M, n.x));
    n.y = Math.max(M, Math.min(height - M, n.y));
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// Sub-models used by individual views.
// ---------------------------------------------------------------------------

/** The subgraph within `hops` of `rootId`. */
export function egoNetwork(m: GraphModel, rootId: string, hops: number): GraphModel {
  const keep = new Set([rootId]);
  let frontier = [rootId];
  for (let h = 0; h < hops; h++) {
    const next: string[] = [];
    for (const e of m.edges) {
      if (frontier.includes(e.source) && !keep.has(e.target)) {
        keep.add(e.target);
        next.push(e.target);
      }
      if (frontier.includes(e.target) && !keep.has(e.source)) {
        keep.add(e.source);
        next.push(e.source);
      }
    }
    frontier = next;
    if (!next.length) break;
  }
  return {
    ...m,
    nodes: m.nodes.filter((n) => keep.has(n.id)),
    edges: m.edges.filter((e) => keep.has(e.source) && keep.has(e.target)),
  };
}

export function degreeOf(m: GraphModel): Record<string, number> {
  const d: Record<string, number> = {};
  for (const n of m.nodes) d[n.id] = 0;
  for (const e of m.edges) {
    d[e.source] = (d[e.source] ?? 0) + 1;
    d[e.target] = (d[e.target] ?? 0) + 1;
  }
  return d;
}

/**
 * Weakly-connected components, computed locally.
 *
 * NOT Louvain. The community view prefers Neo4j GDS via `/graph/actor/{id}`
 * when it is reachable, and says so; this is the stated fallback when it is
 * not, and the view labels which one produced the partition. Calling a WCC
 * partition "communities" without saying so would overstate it -- WCC finds
 * disconnected pieces, not communities.
 */
export function components(m: GraphModel): Record<string, number> {
  const parent: Record<string, string> = {};
  const find = (x: string): string => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  for (const n of m.nodes) parent[n.id] = n.id;
  for (const e of m.edges) {
    const a = find(e.source);
    const b = find(e.target);
    if (a !== b) parent[a] = b;
  }
  const ids: Record<string, number> = {};
  const seen = new Map<string, number>();
  for (const n of m.nodes) {
    const r = find(n.id);
    if (!seen.has(r)) seen.set(r, seen.size);
    ids[n.id] = seen.get(r)!;
  }
  return ids;
}

/** Edges present at or before `date`, for the temporal scrubber. */
export function edgesAsOf(m: GraphModel, date: string | null): GEdge[] {
  if (!date) return m.edges;
  return m.edges.filter((e) => !e.firstSeen || e.firstSeen.slice(0, 10) <= date);
}

/** Every distinct first-seen date in the model, ascending. */
export function timelineDates(m: GraphModel): string[] {
  const set = new Set<string>();
  for (const e of m.edges) if (e.firstSeen) set.add(e.firstSeen.slice(0, 10));
  return [...set].sort();
}

// ---------------------------------------------------------------------------
// Evidence DAG — the courtroom view.
// ---------------------------------------------------------------------------

export interface DagLevel {
  title: string;
  caption: string;
  items: { id: string; label: string; value: string; muted?: boolean; root?: SignalRoot }[];
}

/**
 * Signal → root → collapse → score, from a real `/fusion/pair/{id}` response.
 *
 * The collapse stage is the most contestable step in the model, so it names
 * what was DISCARDED, not just what survived. `roots_collapsed` already carries
 * that; a view that showed only the survivors would be hiding the argument.
 */
export function evidenceDag(pair: PairScore): DagLevel[] {
  const used = Object.entries(pair.roots_used ?? {});
  const collapsed = Object.entries(pair.roots_collapsed ?? {});

  return [
    {
      title: "Signals",
      caption: "Every raw signal the engine observed for this pair.",
      items: collapsed.flatMap(([root, names]) =>
        (names ?? []).map((n) => ({
          id: `sig:${root}:${n}`,
          label: n,
          value: root,
          root: root as SignalRoot,
        }))
      ),
    },
    {
      title: "Roots",
      caption: "Signals grouped by root cause, so one fact is not counted twice.",
      items: used.map(([root, r]) => ({
        id: `root:${root}`,
        label: SIGNAL_LABEL[root as SignalRoot] ?? root,
        value: `s=${r.s.toFixed(2)}  LR=${r.lr.toFixed(3)}`,
        root: root as SignalRoot,
      })),
    },
    {
      title: "Collapse",
      caption:
        "Within a root only the strongest signal survives. The rest are discarded and named here — this is the step most worth arguing with.",
      items: collapsed.flatMap(([root, names]) => {
        const survivors = (names ?? []).slice(0, 1);
        return (names ?? []).map((n) => ({
          id: `col:${root}:${n}`,
          label: n,
          value: survivors.includes(n) ? "survived" : "discarded",
          muted: !survivors.includes(n),
          root: root as SignalRoot,
        }));
      }),
    },
    {
      title: "Score",
      caption: "Reliability-dampened likelihood ratios, multiplied against the prior.",
      items: [
        ...used.map(([root, r]) => ({
          id: `sc:${root}`,
          label: `${SIGNAL_LABEL[root as SignalRoot] ?? root} · r=${r.r}`,
          value: `LR^r = ${r.lr_pow_r.toFixed(3)}`,
          root: root as SignalRoot,
        })),
        {
          id: "sc:total",
          label: "Posterior",
          value: `${pair.p_raw.toFixed(3)} (naive ${pair.naive_stack.toFixed(3)})`,
        },
      ],
    },
  ];
}

export const NODE_COLOR = (kind: EntityKind): string => ENTITY_COLOR[kind] ?? ENTITY_COLOR.email;

/** Above this the lab stops drawing a force layout and says why (DEC-057). */
export const HAIRBALL_LIMIT = 800;
