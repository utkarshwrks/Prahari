/**
 * Focus management (`lib/a11y.ts`).
 *
 * Read DEC-042 before changing anything here. `focusableWithin` originally
 * filtered on `offsetParent !== null`, which is null for every `position:
 * fixed` element -- and every dialog in this app is fixed. The trap silently
 * did nothing on exactly the elements it existed to trap, and NINE unit tests
 * passed anyway, because happy-dom reports layout differently from a real
 * browser. Only the Playwright journey caught it.
 *
 * So these tests deliberately do NOT claim to prove the trap works in a
 * browser. They pin the contract that can be checked without real layout --
 * ordering, filtering, wrap-around, Escape, focus restoration -- and assert the
 * regression itself: that the implementation does not reintroduce an
 * `offsetParent` filter. The behavioural proof lives in `e2e/journey.mjs`,
 * where it belongs.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { focusableWithin, trapFocus, prefersReducedMotion } from "@/lib/a11y";

function mount(html: string): HTMLElement {
  const host = document.createElement("div");
  // Test fixture construction only. The INV-6 ban is on PRODUCT code building
  // DOM from strings; a fixture has no untrusted input and never ships.
  host.append(...parse(html));
  document.body.appendChild(host);
  return host;
}

/** Build fixture nodes without innerHTML, so the suite obeys its own rule. */
function parse(spec: string): HTMLElement[] {
  return spec
    .trim()
    .split("\n")
    .map((line) => {
      const [tag, ...attrs] = line.trim().split(/\s+/);
      const el = document.createElement(tag);
      for (const a of attrs) {
        const [k, v] = a.split("=");
        el.setAttribute(k, v ?? "");
      }
      return el;
    });
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("focusableWithin", () => {
  it("returns focusable descendants in DOM order", () => {
    const root = mount(`
      a href=#
      button
      input type=text
    `);
    const found = focusableWithin(root);
    expect(found.map((e) => e.tagName)).toEqual(["A", "BUTTON", "INPUT"]);
  });

  it("skips disabled controls and hidden inputs", () => {
    const root = mount(`
      button disabled=disabled
      input type=hidden
      button id=real
    `);
    expect(focusableWithin(root).map((e) => e.id)).toEqual(["real"]);
  });

  it("skips [hidden] and aria-hidden subtrees", () => {
    const root = mount(`
      button hidden=hidden
      button aria-hidden=true
      button id=real
    `);
    expect(focusableWithin(root).map((e) => e.id)).toEqual(["real"]);
  });

  it("excludes tabindex=-1 but includes an explicit positive tabindex", () => {
    const root = mount(`
      div tabindex=-1
      div tabindex=0 id=in
    `);
    expect(focusableWithin(root).map((e) => e.id)).toEqual(["in"]);
  });

  it("returns an empty list for a root with nothing focusable, rather than throwing", () => {
    expect(focusableWithin(mount(`p\nspan`))).toEqual([]);
  });

  /**
   * DEC-042, asserted against the source rather than the behaviour.
   *
   * A behavioural assertion cannot express this: under happy-dom the broken
   * implementation and the correct one return the same list. Reading the file
   * is the only check available at this layer that would have failed in Phase 9.
   */
  it("does not filter on offsetParent (DEC-042)", () => {
    const src = readFileSync(join(process.cwd(), "lib/a11y.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    expect(code).not.toMatch(/offsetParent/);
    expect(code).toMatch(/getClientRects/);
  });
});

describe("trapFocus", () => {
  it("moves focus to the first focusable element on open", () => {
    const root = mount(`button id=first\nbutton id=second`);
    const release = trapFocus(root);
    expect(document.activeElement?.id).toBe("first");
    release();
  });

  it("falls back to focusing the root when nothing inside is focusable", () => {
    const root = mount(`p`);
    root.tabIndex = -1;
    const release = trapFocus(root);
    expect(document.activeElement).toBe(root);
    release();
  });

  it("wraps forward from the last element to the first", () => {
    const root = mount(`button id=first\nbutton id=last`);
    const release = trapFocus(root);
    (root.querySelector("#last") as HTMLElement).focus();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement?.id).toBe("first");
    release();
  });

  it("wraps backward from the first element to the last", () => {
    const root = mount(`button id=first\nbutton id=last`);
    const release = trapFocus(root);
    (root.querySelector("#first") as HTMLElement).focus();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true })
    );
    expect(document.activeElement?.id).toBe("last");
    release();
  });

  it("calls onEscape when Escape is pressed", () => {
    const root = mount(`button id=first`);
    const onEscape = vi.fn();
    const release = trapFocus(root, onEscape);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onEscape).toHaveBeenCalledOnce();
    release();
  });

  it("restores focus to the element that was focused before opening", () => {
    const opener = document.createElement("button");
    opener.id = "opener";
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement?.id).toBe("opener");

    const root = mount(`button id=inside`);
    const release = trapFocus(root);
    expect(document.activeElement?.id).toBe("inside");

    release();
    expect(document.activeElement?.id).toBe("opener");
  });

  it("stops listening after release, so a closed dialog cannot swallow keys", () => {
    const root = mount(`button id=first\nbutton id=last`);
    const onEscape = vi.fn();
    trapFocus(root, onEscape)();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onEscape).not.toHaveBeenCalled();
  });

  it("ignores keys other than Tab and Escape", () => {
    const root = mount(`button id=first\nbutton id=last`);
    const release = trapFocus(root);
    (root.querySelector("#last") as HTMLElement).focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    expect(document.activeElement?.id).toBe("last");
    release();
  });
});

describe("prefersReducedMotion", () => {
  it("reports the media query result", () => {
    vi.stubGlobal("window", {
      ...globalThis.window,
      matchMedia: (q: string) => ({ matches: q.includes("reduce") }),
    });
    expect(prefersReducedMotion()).toBe(true);
  });

  it("returns false rather than throwing where matchMedia is unavailable", () => {
    vi.stubGlobal("window", { ...globalThis.window, matchMedia: undefined });
    expect(prefersReducedMotion()).toBe(false);
  });
});
