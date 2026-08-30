/**
 * Focus management for modals and drawers.
 *
 * From the Phase 1 audit: v1 had no focus trap, no Escape handling and no
 * dialog roles. A keyboard user could tab out of an open modal into the page
 * behind it and lose track of where they were, and a screen reader was never
 * told a dialog had opened at all.
 *
 * `aria-live` on the alert feed matters more than usual here: a geofence breach
 * is the entire point of the product, and an officer using a screen reader
 * currently gets no announcement when one fires.
 */

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

/**
 * Trap Tab inside `root` and call `onEscape` on Escape.
 * Returns a cleanup function that also restores the previously focused element,
 * so closing a dialog puts the caret back where the user opened it.
 */
export function trapFocus(root: HTMLElement, onEscape?: () => void): () => void {
  const previouslyFocused = document.activeElement as HTMLElement | null;

  const first = focusableWithin(root)[0];
  (first ?? root).focus?.();

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onEscape?.();
      return;
    }
    if (e.key !== "Tab") return;

    const items = focusableWithin(root);
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const firstEl = items[0];
    const lastEl = items[items.length - 1];
    const active = document.activeElement as HTMLElement | null;

    // Wrap at both ends. Without this, Tab walks out of the dialog into the
    // page behind it, which is the actual v1 bug.
    if (e.shiftKey && (active === firstEl || !root.contains(active))) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && active === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  }

  document.addEventListener("keydown", onKeyDown, true);
  return () => {
    document.removeEventListener("keydown", onKeyDown, true);
    previouslyFocused?.focus?.();
  };
}

/** True when the viewer has asked the OS to reduce motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
