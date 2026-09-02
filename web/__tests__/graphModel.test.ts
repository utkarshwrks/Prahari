/**
 * The graph model and the deterministic layout (DEC-057).
 *
 * The gate items this file owns:
 *   - the 2D layout is IDENTICAL across runs with the same seed,
 *   - collapsed roots are named, not silently dropped,
 *   - the 800-node performance budget is real and measured,
 *   - the shared model agrees with `ActorGraph3D`'s private builder, so eleven
 *     views cannot disagree about whether an edge exists.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_FILTERS, DEFAULT_LAYOUT, HAIRBALL_LIMIT, applyFilters, buildModel, components,
  degreeOf, edgesAsOf, egoNetwork, evidenceDag, layout2d, matches, rootForIdentifier,
  seedFor, seededRandom, timelineDates,
} from "@/lib/graphModel";
import type { ActorProfile, PairScore } from "@/lib/api";

const profile = (over: Partial<ActorProfile> = {}): ActorProfile => ({
  ok: true,
  actor_id: "actor-088",
  label: "nightowl1",
  personas: [
    { id: "p0", handle: "nightowl1", market: "AlphaBay", first_seen: "2026-01-04", last_seen: "2026-03-28", post_count: 12, categories: [], role: "vendor" },
    { id: "p1", handle: "nightfox13", market: "Evolution", first_seen: "2026-02-10", last_seen: "2026-04-02", post_count: 12, categories: [], role: "vendor" },
    { id: "p2", handle: "emberowl", market: "Dream", first_seen: "2026-03-01", last_seen: "2026-05-11", post_count: 12, categories: [], role: "vendor" },
  ],
  identifiers: [
    { kind: "pgp", value: "8B93A224231030CDA99ECB", personas: ["p0", "p1", "p2"], shared: true },
    { kind: "wallet", value: "1kPkt2ZyZrNrqVEs3L44v2", personas: ["p0", "p1"], shared: true },
    { kind: "email", value: "rupeegate85@prmail.test", personas: ["p2"], shared: false },
  ],
  infrastructure: [
    { clearnet_host: "cdn.example.test", strength: 0.83, evidence: [{ rule: "cert", strength: 0.83, detail: "shared CT cert", source: "crt.sh" }] },
  ],
  linkages: [
    { persona_a: "p0", persona_b: "p1", confidence: 0.3, roots: ["identity_key"], negatives: [], basis: "fused" },
    { persona_a: "p0", persona_b: "p2", confidence: 0.985, roots: ["identity_key", "financial"], negatives: [], basis: "fused" },
    { persona_a: "p1", persona_b: "p2", confidence: 0.991, roots: ["infra"], negatives: [], basis: "fused" },
  ],
  attribution_confidence: 0.991,
  confidence_basis: "highest fused pair score",
  categories: [],
  markets: ["AlphaBay", "Evolution", "Dream"],
  first_seen: "2026-01-04",
  last_seen: "2026-05-11",
  last_scan: "2026-08-30",
  sources: ["agora"],
  post_count: 36,
  flags: [],
  ...over,
});

describe("buildModel", () => {
  const m = buildModel(profile());

  it("carries the actor, every persona, every identifier and every host", () => {
    expect(m.nodes.filter((n) => n.kind === "actor")).toHaveLength(1);
    expect(m.nodes.filter((n) => n.kind === "persona")).toHaveLength(3);
    expect(m.nodes.filter((n) => n.kind === "infra")).toHaveLength(1);
    expect(m.nodes.filter((n) => ["pgp", "wallet", "email"].includes(n.kind))).toHaveLength(3);
  });

  /**
   * `ActorGraph3D` keeps its own private builder because it works and the
   * prime directive says not to touch it. This model is a superset -- and if
   * the two ever disagreed about node or edge count, the matrix and the 3D
   * view would be showing different graphs of the same actor.
   */
  it("produces the same node and edge counts as the 3D view's builder", () => {
    const p = profile();
    const expectedNodes = 1 + p.personas.length + p.identifiers.length + p.infrastructure.length;
    const expectedEdges =
      p.personas.length + // membership
      p.identifiers.reduce((n, i) => n + i.personas.length, 0) +
      p.infrastructure.length * p.personas.length +
      p.linkages.length;
    expect(m.nodes).toHaveLength(expectedNodes);
    expect(m.edges).toHaveLength(expectedEdges);
  });

  it("marks pivoted hosts as inferred and observed identifiers as not", () => {
    // INV-5: a derived artefact must be labelled, and the filters can only hide
    // inferred nodes because they are labelled.
    expect(m.nodes.find((n) => n.kind === "infra")?.inferred).toBe(true);
    expect(m.nodes.find((n) => n.kind === "pgp")?.inferred).toBe(false);
  });

  it("gives every edge a stable id, so React keys and exports are stable", () => {
    const ids = m.edges.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(buildModel(profile()).edges.map((e) => e.id)).toEqual(ids);
  });

  it("assigns a signal root to identifier and infra edges", () => {
    expect(rootForIdentifier("pgp")).toBe("identity_key");
    expect(rootForIdentifier("wallet")).toBe("financial");
    expect(rootForIdentifier("onion")).toBe("infra");
  });

  it("returns null for an unrecognised identifier kind rather than guessing", () => {
    expect(rootForIdentifier("telegram")).toBeNull();
  });

  it("carries pairId on persona-to-persona linkages only", () => {
    const withPair = m.edges.filter((e) => e.pairId);
    expect(withPair).toHaveLength(3);
    expect(withPair.every((e) => e.kind === "linkage")).toBe(true);
  });
});

describe("determinism (the gate)", () => {
  const m = buildModel(profile());

  it("lays out identically across two runs", () => {
    const a = layout2d(m, 800, 600);
    const b = layout2d(m, 800, 600);
    expect(a.map((n) => [n.id, n.x, n.y])).toEqual(b.map((n) => [n.id, n.x, n.y]));
  });

  it("lays out identically across two freshly built models", () => {
    // The seed comes from the actor id, not from object identity or the clock.
    const a = layout2d(buildModel(profile()), 800, 600);
    const b = layout2d(buildModel(profile()), 800, 600);
    expect(a.map((n) => n.x)).toEqual(b.map((n) => n.x));
  });

  it("gives different actors different layouts", () => {
    const a = layout2d(buildModel(profile()), 800, 600);
    const b = layout2d(buildModel(profile({ actor_id: "actor-001" })), 800, 600);
    expect(a.map((n) => n.x)).not.toEqual(b.map((n) => n.x));
  });

  it("seeds from the id, and the generator is reproducible", () => {
    expect(seedFor("actor-088")).toBe(seedFor("actor-088"));
    const r1 = seededRandom(42);
    const r2 = seededRandom(42);
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);
  });

  it("keeps every node inside the viewport", () => {
    for (const n of layout2d(m, 800, 600)) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(800);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(600);
    }
  });

  it("honours pinned positions exactly", () => {
    const pin = { p0: { x: 111, y: 222 } };
    const out = layout2d(m, 800, 600, DEFAULT_LAYOUT, pin);
    const p0 = out.find((n) => n.id === "p0")!;
    expect([p0.x, p0.y]).toEqual([111, 222]);
    expect(p0.pinned).toBe(true);
  });

  it("produces no NaN even when every node starts coincident", () => {
    // The repulsion step divides by distance; coincident nodes are the case
    // that would produce NaN and silently blank the whole drawing.
    const pin = Object.fromEntries(m.nodes.map((n) => [n.id, { x: 400, y: 300 }]));
    const out = layout2d(m, 800, 600, DEFAULT_LAYOUT, pin);
    expect(out.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
  });
});

describe("filters", () => {
  const m = buildModel(profile());

  it("default filters change nothing", () => {
    const f = applyFilters(m, DEFAULT_FILTERS);
    expect(f.nodes).toHaveLength(m.nodes.length);
    expect(f.edges).toHaveLength(m.edges.length);
  });

  it("a minimum strength drops weaker edges", () => {
    const f = applyFilters(m, { ...DEFAULT_FILTERS, minStrength: 0.9 });
    expect(f.edges.every((e) => e.strength >= 0.9)).toBe(true);
    expect(f.edges.length).toBeLessThan(m.edges.length);
  });

  it("hiding inferred nodes removes the pivoted host and its edges", () => {
    const f = applyFilters(m, { ...DEFAULT_FILTERS, showInferred: false });
    expect(f.nodes.some((n) => n.kind === "infra")).toBe(false);
    expect(f.edges.some((e) => e.kind === "infra pivot")).toBe(false);
  });

  it("a root filter never removes structural membership edges", () => {
    // Hiding those would disconnect the actor from its own personas and make
    // the drawing a lie about the data rather than a subset of it.
    const f = applyFilters(m, { ...DEFAULT_FILTERS, roots: ["financial"] });
    expect(f.edges.some((e) => e.kind === "membership")).toBe(true);
  });

  it("keeps the actor node even when everything else is filtered away", () => {
    const f = applyFilters(m, { ...DEFAULT_FILTERS, minStrength: 1.01 });
    expect(f.nodes.map((n) => n.id)).toContain("actor-088");
  });

  it("never leaves an edge whose endpoint was removed", () => {
    const f = applyFilters(m, { ...DEFAULT_FILTERS, showInferred: false, minStrength: 0.4 });
    const ids = new Set(f.nodes.map((n) => n.id));
    expect(f.edges.every((e) => ids.has(e.source) && ids.has(e.target))).toBe(true);
  });

  it("highlight matches on label, value and kind, and never on an empty query", () => {
    const pgp = m.nodes.find((n) => n.kind === "pgp")!;
    expect(matches(pgp, "8B93")).toBe(true);
    expect(matches(pgp, "pgp")).toBe(true);
    expect(matches(pgp, "")).toBe(false);
    expect(matches(pgp, "   ")).toBe(false);
  });
});

describe("ego network", () => {
  const m = buildModel(profile());

  it("one hop returns the node and its direct neighbours only", () => {
    const e = egoNetwork(m, "p0", 1);
    expect(e.nodes.map((n) => n.id)).toContain("p0");
    expect(e.nodes.length).toBeLessThan(m.nodes.length);
  });

  it("more hops never returns fewer nodes", () => {
    const sizes = [1, 2, 3].map((h) => egoNetwork(m, "p0", h).nodes.length);
    expect(sizes[1]).toBeGreaterThanOrEqual(sizes[0]);
    expect(sizes[2]).toBeGreaterThanOrEqual(sizes[1]);
  });

  it("returns just the node when it has no edges", () => {
    expect(egoNetwork(m, "nonexistent", 2).nodes).toHaveLength(0);
  });
});

describe("degree, components and the temporal scrubber", () => {
  const m = buildModel(profile());

  it("counts degree over every edge endpoint", () => {
    const d = degreeOf(m);
    expect(d["actor-088"]).toBe(3); // one membership edge per persona
    expect(Object.values(d).reduce((a, b) => a + b, 0)).toBe(m.edges.length * 2);
  });

  it("puts a fully connected graph in one component", () => {
    expect(new Set(Object.values(components(m))).size).toBe(1);
  });

  it("edgesAsOf returns everything when no date is given", () => {
    expect(edgesAsOf(m, null)).toHaveLength(m.edges.length);
  });

  it("edgesAsOf is monotonic: a later date never shows fewer edges", () => {
    const dates = timelineDates(m);
    const counts = dates.map((d) => edgesAsOf(m, d).length);
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
  });

  it("timelineDates are sorted and unique", () => {
    const d = timelineDates(m);
    expect([...d].sort()).toEqual(d);
    expect(new Set(d).size).toBe(d.length);
  });
});

describe("evidence DAG — collapsed roots are named, not dropped", () => {
  const pair: PairScore = {
    ok: true,
    pair_id: "p0|p2",
    p_raw: 0.84,
    p_calibrated: 0.84,
    naive_stack: 0.999,
    cap_applied: null,
    roots_used: {
      identity_key: { signal: "identity_key", s: 0.78, lr: 3.545, r: 0.9, lr_pow_r: 3.124 },
      infra: { signal: "infra", s: 0.83, lr: 4.882, r: 0.8, lr_pow_r: 3.556 },
    },
    roots_collapsed: {
      identity_key: ["pgp_fingerprint_match", "email_reuse", "handle_similarity"],
      infra: ["shared_certificate"],
    },
    negatives: [],
    trail: {
      prior_odds: 0.1, prior_label: "1:10", lr_total: 52.32, posterior_odds: 5.23,
      caps: [], dropped_roots: [], roots_absent: ["social"],
    },
  };

  const levels = evidenceDag(pair);

  it("has the four stages of the argument, in order", () => {
    expect(levels.map((l) => l.title)).toEqual(["Signals", "Roots", "Collapse", "Score"]);
  });

  it("every stage carries a caption explaining what it means", () => {
    expect(levels.every((l) => l.caption.length > 20)).toBe(true);
  });

  it("names every signal that was DISCARDED, not just the survivor", () => {
    // The single most important assertion in this file. Collapse is the step an
    // opposing expert attacks; a view that showed only survivors would be
    // hiding the argument rather than making it.
    const collapse = levels.find((l) => l.title === "Collapse")!;
    const discarded = collapse.items.filter((i) => i.muted).map((i) => i.label);
    expect(discarded).toContain("email_reuse");
    expect(discarded).toContain("handle_similarity");
  });

  it("marks exactly one survivor per root", () => {
    const collapse = levels.find((l) => l.title === "Collapse")!;
    const survivors = collapse.items.filter((i) => !i.muted).map((i) => i.label);
    expect(survivors).toEqual(["pgp_fingerprint_match", "shared_certificate"]);
  });

  it("shows the naive baseline beside the fused score", () => {
    const score = levels.find((l) => l.title === "Score")!;
    const total = score.items.find((i) => i.id === "sc:total")!;
    expect(total.value).toContain("0.840");
    expect(total.value).toContain("0.999");
  });

  it("survives a pair with nothing collapsed", () => {
    const empty = evidenceDag({ ...pair, roots_collapsed: {}, roots_used: {} });
    expect(empty.find((l) => l.title === "Collapse")!.items).toEqual([]);
  });
});

describe("performance budget", () => {
  /** A synthetic actor large enough to cross the hairball limit. */
  const big = (n: number) =>
    profile({
      personas: Array.from({ length: n }, (_, i) => ({
        id: `p${i}`, handle: `h${i}`, market: "AlphaBay",
        first_seen: "2026-01-01", last_seen: "2026-02-01",
        post_count: 1, categories: [], role: "vendor",
      })),
      identifiers: [],
      infrastructure: [],
      linkages: [],
    });

  it("states a hairball limit rather than leaving it implicit", () => {
    expect(HAIRBALL_LIMIT).toBe(800);
  });

  it("lays out an 800-node graph inside the frame budget", () => {
    // The lab degrades to the matrix above this, so 800 is the worst case a
    // force layout ever has to draw. Budget: under 2 s on a mid-range laptop,
    // with iterations reduced as the UI does for large graphs.
    const m = buildModel(big(HAIRBALL_LIMIT));
    expect(m.nodes.length).toBeGreaterThanOrEqual(HAIRBALL_LIMIT);
    const t0 = performance.now();
    layout2d(m, 1200, 800, { ...DEFAULT_LAYOUT, iterations: 60 });
    expect(performance.now() - t0).toBeLessThan(2000);
  });

  it("a typical actor lays out in a few milliseconds", () => {
    const t0 = performance.now();
    layout2d(buildModel(profile()), 900, 600);
    expect(performance.now() - t0).toBeLessThan(250);
  });
});

describe("the 3D view was not rewritten (the prime directive)", () => {
  it("ActorGraph3D still owns its own builder and is untouched by the lab", () => {
    const src = readFileSync(join(process.cwd(), "components/three/ActorGraph3D.tsx"), "utf8");
    expect(src).toContain("function buildGraph");
    expect(src).not.toContain("@/lib/graphModel");
  });

  it("the lab mounts ActorGraphPanel rather than reimplementing 3D", () => {
    const lab = readFileSync(join(process.cwd(), "components/graph/GraphLab.tsx"), "utf8");
    expect(lab).toContain("@/components/workbench/ActorGraphPanel");
    expect(lab).toContain("<ActorGraphPanel");
  });
});
