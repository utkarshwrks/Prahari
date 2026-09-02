/**
 * The eleven graph kinds, and the promises the lab makes about them (DEC-057).
 *
 * Structural assertions over the source, for the same reason `security.test.ts`
 * is: "every view has a caption" and "the fallback is automatic" are statements
 * about the file, not about one code path. The rendered behaviour is covered by
 * the e2e, which switches every view in a real browser.
 *
 * The captions matter more than they look. A picture of a network implies a
 * claim, and an unlabelled picture implies whichever claim the viewer already
 * held — so a view without a caption stating what its layout MEANS is not a
 * finished view.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as views from "@/components/graph/views";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const LAB = read("components/graph/GraphLab.tsx");
const VIEWS = read("components/graph/views.tsx");
const INSPECTOR = read("components/graph/NodeInspector.tsx");

/** The eleven kinds the phase promises. */
const KINDS = [
  "force3d", "force2d", "ego", "matrix", "dag", "temporal",
  "bipartite", "sankey", "community", "diff", "list",
];

describe("eleven graph kinds", () => {
  it("offers exactly eleven, and no more", () => {
    const listed = [...LAB.matchAll(/id: "([a-z0-9]+)", label:/g)].map((m) => m[1]);
    expect(listed).toHaveLength(11);
    expect(listed.sort()).toEqual([...KINDS].sort());
  });

  it("every kind is reachable from the view switch", () => {
    for (const k of KINDS) expect(LAB, k).toContain(`case "${k}":`);
  });

  it("every kind says what question it answers", () => {
    const answers = [...LAB.matchAll(/answers: "([^"]+)"/g)].map((m) => m[1]);
    expect(answers).toHaveLength(11);
    expect(answers.every((a) => a.length > 12)).toBe(true);
  });
});

describe("every view is captioned", () => {
  const CAPTIONS = [
    ["force2d", views.FORCE2D_CAPTION],
    ["ego", views.EGO_CAPTION],
    ["matrix", views.MATRIX_CAPTION],
    ["dag", views.DAG_CAPTION],
    ["temporal", views.TEMPORAL_CAPTION],
    ["bipartite", views.BIPARTITE_CAPTION],
    ["sankey", views.SANKEY_CAPTION],
    ["community", views.COMMUNITY_CAPTION],
    ["diff", views.DIFF_CAPTION],
    ["list", views.LIST_CAPTION],
  ] as const;

  it("exports a caption for all ten non-3D views, and the lab supplies the 3D one", () => {
    expect(CAPTIONS).toHaveLength(10);
    expect(LAB).toContain("FORCE3D_CAPTION");
  });

  it.each(CAPTIONS)("%s's caption explains what the layout means", (_id, caption) => {
    expect(caption.length).toBeGreaterThan(80);
    // A caption that only names the view is not a caption.
    expect(caption).toMatch(/\b(means|meaning|meaningful|answers|shows|is|reads)\b/i);
  });

  it("the lab renders exactly one caption element, always", () => {
    expect(LAB).toContain("<Caption>");
    expect(VIEWS).toContain('data-testid="view-caption"');
  });

  it("the standing honesty line about position appears where layout is spatial", () => {
    // "Distance is meaningful; absolute position is not" — the claim a force
    // layout makes and the one viewers most often over-read.
    expect(views.FORCE2D_CAPTION).toContain("distance is meaningful");
    expect(LAB).toContain("distance is meaningful");
  });
});

describe("the honesty rules each view carries", () => {
  it("the community view names the source of its partition", () => {
    // Neo4j GDS Louvain and a local weakly-connected-components pass are
    // different claims; WCC finds disconnected pieces, not communities.
    expect(VIEWS).toContain('data-testid="community-source"');
    expect(views.COMMUNITY_CAPTION).toMatch(/Louvain|weakly-connected/i);
  });

  it("the value-flow view refuses to draw a width from a number it does not have", () => {
    expect(views.SANKEY_CAPTION).toContain("transaction count, not amount");
  });

  it("the diff view does not conclude that two actors are one operator", () => {
    expect(views.DIFF_CAPTION).toMatch(/does not make it|fused judgement/i);
  });

  it("the fallback promises completeness, not a summary", () => {
    expect(views.LIST_CAPTION).toMatch(/no edge is dropped|complete/i);
  });

  it("the evidence DAG names what was discarded", () => {
    expect(views.DAG_CAPTION).toMatch(/discarded/i);
  });
});

describe("the automatic fallback survives (INV-11)", () => {
  it("reduced motion or missing WebGL falls back to the linkage list", () => {
    expect(LAB).toContain("prefersReducedMotion()");
    expect(LAB).toContain("experimental-webgl");
    expect(LAB).toMatch(/effectiveView === "force3d" && !canRender3d \? "list"/);
  });

  it("the fallback is announced, not silent", () => {
    // Rendering something other than the view the analyst chose, without
    // saying so, is the tool lying about what it is showing.
    expect(LAB).toContain('data-testid="degraded-notice"');
    expect(LAB).toContain("No WebGL, or reduced motion is on");
  });

  it("the linkage list renders every edge, with no slice or cap", () => {
    const body = VIEWS.slice(VIEWS.indexOf("export function LinkageList"));
    expect(body).toContain("m.edges.map");
    expect(body).not.toMatch(/\.slice\(0,\s*\d+\)/);
  });
});

describe("the performance budget is enforced and explained", () => {
  it("degrades to the matrix above the node budget", () => {
    expect(LAB).toContain("HAIRBALL_LIMIT");
    expect(LAB).toMatch(/tooBig && forceViews\.includes\(view\) \? "matrix"/);
  });

  it("states the reason rather than silently switching", () => {
    expect(LAB).toContain("past the ${HAIRBALL_LIMIT}-node budget");
    expect(LAB).toContain("Filter down to return to");
  });

  it("keeps the heavy 3D bundle behind a dynamic import", () => {
    const panel = read("components/workbench/ActorGraphPanel.tsx");
    expect(panel).toContain('dynamic(() => import("../three/ActorGraph3D")');
    // The lab must not import the three module directly, or the dynamic
    // boundary is defeated and every view pays for WebGL.
    expect(LAB).not.toContain("three/ActorGraph3D");
  });
});

describe("the node inspector invents nothing", () => {
  it("names the reliability exponent, or says it is not published", () => {
    expect(INSPECTOR).toContain("reliability r = ");
    expect(INSPECTOR).toContain("not published for this root");
  });

  it("shows collapsed roots with survivors and discards labelled", () => {
    expect(INSPECTOR).toContain('data-testid="collapse-detail"');
    expect(INSPECTOR).toContain("survived");
    expect(INSPECTOR).toContain("discarded");
    expect(INSPECTOR).toContain("roots_collapsed");
  });

  it("renders 'not recorded' rather than a blank for missing provenance", () => {
    const notRecorded = (INSPECTOR.match(/not recorded/g) ?? []).length;
    expect(notRecorded).toBeGreaterThanOrEqual(4);
  });

  it("offers chain tracing on wallets only and geolocation on hosts only", () => {
    // An action that cannot succeed should not be on screen: offering "trace on
    // chain" for a PGP key implies a capability that does not exist.
    expect(INSPECTOR).toContain("isWallet &&");
    expect(INSPECTOR).toContain("isHost &&");
    // JSX wraps prose across lines, so match on the normalised text.
    expect(INSPECTOR.replace(/\s+/g, " ")).toContain(
      "an action that cannot succeed should not be on screen"
    );
  });
});

describe("controls are deep-linked", () => {
  it("every control reads its value from the query string", () => {
    for (const key of [
      'get("view")', 'get("node")', 'get("hops")', 'get("asOf")',
      'get("roots")', 'get("min")', 'get("inferred")', 'get("weak")',
      'get("q")', 'get("charge")', 'get("dist")', 'get("iter")', 'get("diff")',
    ]) {
      expect(LAB, key).toContain(key);
    }
  });

  it("writes with replace, so dragging a slider does not fill the history", () => {
    expect(LAB).toContain("router.replace");
  });

  it("states the tau resolution caveat on the strength slider itself", () => {
    // Not buried in docs: the control must not imply finer precision than the
    // 1,336 validation pairs support.
    expect(LAB).toContain("1,336 validation pairs");
    expect(LAB).toContain("rough sieve");
  });

  it("says highlight never hides", () => {
    expect(LAB).toContain("Highlights, never hides");
  });
});
