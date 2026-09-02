/**
 * The workspace route tree (DEC-056).
 *
 * Structural assertions over `app/`, because the thing most likely to go wrong
 * in a ten-route refactor is not a component -- it is a route that quietly
 * stops existing, or a legacy surface that quietly stops being reachable. The
 * prime directive of this upgrade is "additive only, nothing that works today
 * may stop working", and that is a claim about the file tree as much as about
 * behaviour.
 *
 * Rendering behaviour is covered by the e2e walk, which loads all eleven routes
 * in a real browser against a real engine.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const app = (p: string) => join(ROOT, "app", p);
const read = (p: string) => readFileSync(app(p), "utf8");

/** The ten routes the phase promises, plus the legacy cockpit. */
const ROUTES: [string, string][] = [
  ["/workbench", "workbench/page.tsx"],
  ["/workbench/actors", "workbench/actors/page.tsx"],
  ["/workbench/actor/[id]", "workbench/actor/[id]/page.tsx"],
  ["/workbench/actor/[id]/graph", "workbench/actor/[id]/graph/page.tsx"],
  ["/workbench/actor/[id]/evidence", "workbench/actor/[id]/evidence/page.tsx"],
  ["/workbench/actor/[id]/timeline", "workbench/actor/[id]/timeline/page.tsx"],
  ["/workbench/actor/[id]/chain", "workbench/actor/[id]/chain/page.tsx"],
  ["/workbench/tor", "workbench/tor/page.tsx"],
  ["/workbench/case/[caseId]", "workbench/case/[caseId]/page.tsx"],
  ["/workbench/compare", "workbench/compare/page.tsx"],
  ["/workbench/classic", "workbench/classic/page.tsx"],
];

describe("the route tree", () => {
  it.each(ROUTES)("%s exists", (_route, file) => {
    expect(existsSync(app(file))).toBe(true);
  });

  it("delivers ten workspace routes plus the classic cockpit", () => {
    expect(ROUTES).toHaveLength(11);
  });

  it("every route file default-exports a component", () => {
    for (const [, file] of ROUTES) {
      expect(read(file), file).toMatch(/export default (async )?function/);
    }
  });
});

describe("nothing was removed (the prime directive)", () => {
  const LEGACY = [
    "components/workbench/Workbench.tsx",
    "components/workbench/ActorList.tsx",
    "components/workbench/ActorProfile.tsx",
    "components/workbench/ActorGraphPanel.tsx",
    "components/workbench/ActorTimeline.tsx",
    "components/workbench/EvidenceTrail.tsx",
    "components/workbench/TimingPanel.tsx",
    "components/workbench/ChainPanel.tsx",
    "components/workbench/AuditPanel.tsx",
    "components/workbench/ActorReportPreview.tsx",
    "components/workbench/Header.tsx",
    "components/three/ActorGraph3D.tsx",
  ];

  it.each(LEGACY)("%s still exists", (f) => {
    expect(existsSync(join(ROOT, f))).toBe(true);
  });

  it("the classic cockpit renders the same component the cockpit always did", () => {
    const classic = read("workbench/classic/page.tsx");
    expect(classic).toContain("@/components/workbench/Workbench");
  });

  it("the workspace REUSES the legacy panels rather than reimplementing them", () => {
    // Phase 3 rebuilds the graph page on top of ActorGraphPanel; if these
    // routes had forked the panels, that phase would be starting from a
    // divergent copy.
    const uses: [string, string][] = [
      ["workbench/actor/[id]/page.tsx", "components/workbench/ActorProfile"],
      ["workbench/actor/[id]/graph/page.tsx", "components/workbench/ActorGraphPanel"],
      ["workbench/actor/[id]/evidence/page.tsx", "components/workbench/EvidenceTrail"],
      ["workbench/actor/[id]/timeline/page.tsx", "components/workbench/ActorTimeline"],
      ["workbench/actor/[id]/chain/page.tsx", "components/workbench/ChainPanel"],
      ["workbench/tor/page.tsx", "components/workbench/TimingPanel"],
      ["workbench/case/[caseId]/page.tsx", "components/workbench/AuditPanel"],
    ];
    for (const [file, dep] of uses) expect(read(file), file).toContain(dep);
  });
});

describe("the feature flag gates the shell, not the routes", () => {
  it("the layout renders children bare when the flag is off", () => {
    const layout = read("workbench/layout.tsx");
    expect(layout).toContain("FEATURES.workspaceRoutes");
    expect(layout).toMatch(/if \(!FEATURES\.workspaceRoutes\) return <>\{children\}<\/>/);
  });

  it("/workbench serves the cockpit via a rewrite when the flag is off", () => {
    // Branching inside page.tsx put BOTH components in the bundle: 256 kB
    // first-load JS against 103 kB for the Overview alone, because the dead
    // branch dragged three.js in. The rewrite splits them at the routing layer.
    const cfg = readFileSync(join(ROOT, "next.config.mjs"), "utf8");
    expect(cfg).toContain("NEXT_PUBLIC_FF_WORKSPACE");
    expect(cfg).toContain("/workbench/classic");
  });

  it("the flag defaults off, so the legacy surface is what ships untouched", () => {
    const features = readFileSync(join(ROOT, "lib/features.ts"), "utf8");
    expect(features).toContain('NEXT_PUBLIC_FF_WORKSPACE === "1"');
  });
});

describe("accessibility carries forward (INV-11)", () => {
  const shell = readFileSync(join(ROOT, "components/workspace/WorkspaceShell.tsx"), "utf8");
  const palette = readFileSync(join(ROOT, "components/workspace/CommandPalette.tsx"), "utf8");

  it("the shell provides a skip-to-content link as the first tab stop", () => {
    expect(shell).toContain("Skip to content");
    expect(shell).toContain('id="workspace-content"');
  });

  it("the navigator rail is a labelled landmark with a current-page marker", () => {
    expect(shell).toMatch(/<nav\s+aria-label="Workspace"/);
    expect(shell).toContain('aria-current={active ? "page" : undefined}');
  });

  /**
   * FINDING-07, closed.
   *
   * The v2 rebuild removed every dialog, so `trapFocus` -- the DEC-042 fix that
   * cost a Playwright run to find -- was referenced by no code and guarded
   * nothing. The command palette is the first dialog the workspace adds, and it
   * uses the trap rather than hand-rolling a fourth version of the same bug.
   */
  it("the command palette uses lib/a11y trapFocus (FINDING-07)", () => {
    expect(palette).toContain('from "@/lib/a11y"');
    expect(palette).toContain("trapFocus(panelRef.current, onClose)");
  });

  it("the command palette is a real modal dialog", () => {
    expect(palette).toContain('role="dialog"');
    expect(palette).toContain('aria-modal="true"');
    expect(palette).toContain('aria-label="Command palette"');
  });

  it("the palette's results are a labelled listbox with a selected option", () => {
    expect(palette).toContain('role="listbox"');
    expect(palette).toContain('role="option"');
    expect(palette).toContain("aria-selected={i === cursor}");
  });

  it("the actors table marks its sort direction for assistive tech", () => {
    const table = readFileSync(join(ROOT, "components/workspace/ActorsTable.tsx"), "utf8");
    expect(table).toContain("aria-sort=");
    expect(table).toContain('scope="col"');
  });
});

describe("deep-linkable state", () => {
  const table = readFileSync(join(ROOT, "components/workspace/ActorsTable.tsx"), "utf8");
  const compare = readFileSync(join(ROOT, "components/workspace/CompareView.tsx"), "utf8");

  it("the actor list keeps search, band, sort and direction in the URL", () => {
    for (const key of ['get("q")', 'get("band")', 'get("sort")', 'get("dir")']) {
      expect(table).toContain(key);
    }
  });

  it("the actor list writes state with replace, so filtering does not spam history", () => {
    expect(table).toContain("router.replace");
  });

  it("compare keeps both actor ids in the URL", () => {
    expect(compare).toContain('get("a")');
    expect(compare).toContain('get("b")');
  });

  it("the evidence route accepts a pair id from the query string", () => {
    expect(read("workbench/actor/[id]/evidence/page.tsx")).toContain('get("pair")');
  });
});

describe("the compare view refuses to conclude", () => {
  const compare = readFileSync(join(ROOT, "components/workspace/CompareView.tsx"), "utf8");

  it("computes no score of its own", () => {
    // Rule 5 of the playbook: no new claim may exceed what the code does. A
    // comparison view is exactly where a tool starts implying things.
    expect(compare).not.toMatch(/naive_stack|lr_total|posterior|\* *0\.\d+/);
  });

  it("states on screen that shared identifiers are observations, not a verdict", () => {
    expect(compare).toContain("not a verdict");
    expect(compare).toContain("does not compute one");
  });
});
