/**
 * The generative skin engine (`lib/skins.ts`).
 *
 * The registry drives the pre-paint picker, the reshuffle control and the CSS
 * token sets in globals.css. The three must agree: a skin id in the registry
 * with no matching `html[data-skin="…"]` block renders an unstyled page before
 * anyone notices.
 *
 * Phase 1 rewrites the picker to draw once per VISIT rather than once per page
 * load. These tests pin the properties that must survive that rewrite, so the
 * phase has a baseline to break against rather than a blank file.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SKINS, LAYOUTS, SKIN_PICKER_SCRIPT } from "@/lib/skins";

const GLOBALS = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

describe("the skin registry", () => {
  it("holds the six hand-tuned skins", () => {
    expect(SKINS).toHaveLength(6);
  });

  it("has unique ids", () => {
    expect(new Set(SKINS.map((s) => s.id)).size).toBe(SKINS.length);
  });

  it("gives every skin a name, a mood and a hex accent for the swatch", () => {
    for (const s of SKINS) {
      expect(s.id).toMatch(/^[a-z]+$/);
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.mood.length).toBeGreaterThan(0);
      expect(s.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("offers both rail layouts", () => {
    expect([...LAYOUTS]).toEqual(["a", "b"]);
  });

  /**
   * The registry and the stylesheet are two lists that must not drift. A skin
   * present in one and absent from the other is invisible until someone draws
   * it, which by construction happens to a user and not to a developer.
   */
  it("every registered skin has a token block in globals.css", () => {
    const missing = SKINS.filter((s) => !GLOBALS.includes(`[data-skin="${s.id}"]`));
    expect(missing.map((s) => s.id)).toEqual([]);
  });

  it("every token block in globals.css is a registered skin", () => {
    const declared = [...GLOBALS.matchAll(/\[data-skin="([a-z]+)"\]/g)].map((m) => m[1]);
    const unknown = [...new Set(declared)].filter((id) => !SKINS.some((s) => s.id === id));
    expect(unknown).toEqual([]);
  });
});

describe("the pre-paint picker script", () => {
  it("is dependency-free and synchronous", () => {
    // It runs in <head> before first paint. An import, await or fetch here
    // means a flash of the default palette followed by a repaint.
    expect(SKIN_PICKER_SCRIPT).not.toMatch(/\bimport\b|\bawait\b|\bfetch\b/);
    expect(SKIN_PICKER_SCRIPT).toMatch(/^\s*\(function\(\)\{/);
  });

  it("embeds the registry ids, so the script and the registry cannot disagree", () => {
    for (const s of SKINS) expect(SKIN_PICKER_SCRIPT).toContain(`"${s.id}"`);
  });

  it("validates ?skin= and the lock against the registry before applying them", () => {
    // An unchecked value would land straight in a data attribute.
    expect(SKIN_PICKER_SCRIPT).toMatch(/ids\.indexOf\(forced\)>=0/);
    expect(SKIN_PICKER_SCRIPT).toMatch(/ids\.indexOf\(locked\)>=0/);
  });

  it("wraps storage access so a private-mode throw cannot break first paint", () => {
    expect(SKIN_PICKER_SCRIPT).toMatch(/try\{/);
    expect(SKIN_PICKER_SCRIPT).toMatch(/catch\(e\)/);
    // The fallback must still set a skin, not leave the page unstyled.
    expect(SKIN_PICKER_SCRIPT).toMatch(/catch\(e\)\{\s*document\.documentElement\.setAttribute\('data-skin'/);
  });

  it("sets skin, layout and freshness on the document element", () => {
    for (const attr of ["data-skin", "data-layout", "data-fresh"]) {
      expect(SKIN_PICKER_SCRIPT).toContain(`'${attr}'`);
    }
  });

  it("falls back to a registered skin id", () => {
    const fallback = SKIN_PICKER_SCRIPT.match(/setAttribute\('data-skin','([a-z]+)'\)/)?.[1];
    expect(SKINS.some((s) => s.id === fallback)).toBe(true);
  });
});

/**
 * INV-11 and the Phase 1 gate: a skin is a pure token swap. It may change
 * palette, type and shape. It may NOT change a colour that carries meaning --
 * in the graph legend colour IS the entity type, so a skin that moved those
 * tokens would move the evidence under the analyst.
 *
 * Phase 1 separates the semantic tokens from the decorative ones and asserts
 * they are identical across all six skins. This records the state that phase
 * starts from, honestly: today the separation does not exist yet.
 */
describe("semantic vs decorative tokens (Phase 1 baseline)", () => {
  it("skin blocks redefine decorative tokens", () => {
    const block = GLOBALS.slice(GLOBALS.indexOf('[data-skin="abyss"]'));
    expect(block).toMatch(/--accent/);
  });

  it("records that semantic signal-root tokens are not yet separated", () => {
    // Phase 1 introduces --sig-identity, --sig-infra, --sig-financial,
    // --sig-temporal, --sig-linguistic, --sig-social and asserts they are
    // constant across skins. Until then this states the truth rather than
    // asserting a guarantee the code does not make.
    const SIGNAL_TOKENS = [
      "--sig-identity", "--sig-infra", "--sig-financial",
      "--sig-temporal", "--sig-linguistic", "--sig-social",
    ];
    const present = SIGNAL_TOKENS.filter((t) => GLOBALS.includes(t));
    expect(present).toEqual([]);
  });
});
