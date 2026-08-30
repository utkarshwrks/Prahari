// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { focusableWithin, trapFocus, prefersReducedMotion } from "@/lib/a11y";

function dialog() {
  document.body.innerHTML = `
    <button id="outside">outside</button>
    <div id="dlg" role="dialog" aria-modal="true">
      <button id="a">a</button>
      <input id="b" />
      <button id="c" disabled>disabled</button>
      <a id="d" href="#x">link</a>
    </div>`;
  return document.getElementById("dlg") as HTMLElement;
}

describe("focusableWithin", () => {
  it("finds interactive elements and skips disabled ones", () => {
    const ids = focusableWithin(dialog()).map((e) => e.id);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).toContain("d");
    expect(ids).not.toContain("c");
  });
});

describe("trapFocus", () => {
  it("focuses the first element on open", () => {
    const d = dialog();
    const release = trapFocus(d);
    expect(document.activeElement?.id).toBe("a");
    release();
  });

  it("wraps Tab from the last element back to the first", () => {
    const d = dialog();
    const release = trapFocus(d);
    (document.getElementById("d") as HTMLElement).focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement?.id).toBe("a");
    release();
  });

  it("wraps Shift+Tab from the first element back to the last", () => {
    const d = dialog();
    const release = trapFocus(d);
    (document.getElementById("a") as HTMLElement).focus();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true })
    );
    expect(document.activeElement?.id).toBe("d");
    release();
  });

  it("calls onEscape when Escape is pressed", () => {
    const d = dialog();
    const onEscape = vi.fn();
    const release = trapFocus(d, onEscape);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onEscape).toHaveBeenCalledOnce();
    release();
  });

  it("restores focus to the opener on release", () => {
    // Build the dialog FIRST: dialog() resets document.body, which would
    // detach an opener created before it and make the restore un-testable.
    const d = dialog();
    const opener = document.getElementById("outside") as HTMLElement;
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const release = trapFocus(d);
    expect(document.activeElement?.id).toBe("a");
    release();
    expect(document.activeElement).toBe(opener);
  });

  it("removes its listener on release", () => {
    const onEscape = vi.fn();
    const release = trapFocus(dialog(), onEscape);
    release();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(onEscape).not.toHaveBeenCalled();
  });
});

describe("prefersReducedMotion", () => {
  it("reports what the OS says", () => {
    // @ts-expect-error test stub
    window.matchMedia = (q: string) => ({ matches: q.includes("reduce") });
    expect(prefersReducedMotion()).toBe(true);
  });
});

describe("globals.css honours prefers-reduced-motion", () => {
  it("gates animation behind the media query", async () => {
    const fs = await import("fs");
    const css = fs.readFileSync("app/globals.css", "utf8");
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    // Reducing motion must not remove information: the siren still renders.
    expect(css).toMatch(/siren-ring/);
  });
});
