/**
 * The generative skin engine (`lib/skins.ts`).
 *
 * The registry drives the pre-paint picker, the reshuffle control and the CSS
 * token sets in globals.css. The three must agree: a skin id in the registry
 * with no matching `html[data-skin="…"]` block renders an unstyled page before
 * anyone notices.
 *
 * DEC-055 made the picker draw once per VISIT rather than once per page load.
 * These tests pin the registry and the pre-paint script's structural contract;
 * the resolver's behaviour is covered in `skinSession.test.ts` and the whole
 * thing is driven for real by the e2e walk.
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
    expect(SKIN_PICKER_SCRIPT).toMatch(/ids\.indexOf\(lock\)>=0/);
  });

  it("validates every field of a restored session record (DEC-055)", () => {
    // A stored record is attacker-influencable in a shared-machine scenario and
    // must be checked field by field, not trusted because it parsed.
    expect(SKIN_PICKER_SCRIPT).toMatch(/o\.v===V/);
    expect(SKIN_PICKER_SCRIPT).toMatch(/ids\.indexOf\(o\.skin\)>=0/);
    expect(SKIN_PICKER_SCRIPT).toMatch(/layouts\.indexOf\(o\.layout\)>=0/);
    expect(SKIN_PICKER_SCRIPT).toMatch(/fonts\.indexOf\(o\.fontPair\)>=0/);
  });

  it("mirrors the resolver's four tiers, in order (DEC-055)", () => {
    // The script cannot import resolveDraw -- it must be dependency-free inline
    // JS -- so this asserts the mirror carries the same tiers. The decisive
    // check is the e2e walk, which drives the real script.
    const order = ["'query'", "'lock'", "'session'", "'fresh'"].map((t) =>
      SKIN_PICKER_SCRIPT.indexOf(t)
    );
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("persists a fresh draw so the rest of the visit reuses it", () => {
    expect(SKIN_PICKER_SCRIPT).toMatch(/sessionStorage\.setItem\(SESSION/);
  });

  it("does not persist a ?skin= or an unchanged session draw", () => {
    // persist is set false on the query tier and on the session tier; only a
    // fresh draw (and a lock with no session yet) writes.
    expect(SKIN_PICKER_SCRIPT).toMatch(/src='query'; persist=false/);
    expect(SKIN_PICKER_SCRIPT).toMatch(/src='session'; persist=false/);
  });

  it("wraps storage access so a private-mode throw cannot break first paint", () => {
    // Every read goes through get(), which swallows its own throw, and every
    // write has its own catch. Safari private mode makes even READING throw.
    expect(SKIN_PICKER_SCRIPT).toMatch(/function get\(store,key\)\{ try\{[^}]*\}catch\(e\)\{ return null; \} \}/);
    expect(SKIN_PICKER_SCRIPT).toMatch(/setItem\(SESSION[^;]*; \}catch\(e\)\{\}/);
    // The fallback must still set a skin, not leave the page unstyled.
    const tail = SKIN_PICKER_SCRIPT.slice(SKIN_PICKER_SCRIPT.lastIndexOf("}catch(e){"));
    expect(tail).toMatch(/setAttribute\('data-skin','ember'\)/);
    expect(tail).toMatch(/setAttribute\('data-layout','a'\)/);
    expect(tail).toMatch(/setAttribute\('data-font','0'\)/);
  });

  it("sets skin, layout, type, source and freshness on the document element", () => {
    for (const attr of ["data-skin", "data-layout", "data-font", "data-skin-source", "data-fresh"]) {
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
 * palette, type and shape. It may NOT change a colour that carries meaning.
 *
 * Phase 0b recorded that the separation did not exist yet. DEC-055 created it;
 * the full guarantee is asserted in `signals.test.ts` (every skin block, every
 * token, both directions) and in the e2e six-skin walk. What remains here is
 * the complement: skins must still be free to move DECORATIVE tokens, or the
 * separation would be meaningless.
 */
describe("semantic vs decorative tokens (DEC-055)", () => {
  it("skin blocks redefine decorative tokens", () => {
    const block = GLOBALS.slice(GLOBALS.indexOf('[data-skin="abyss"]'));
    expect(block).toMatch(/--accent/);
  });

  it("the semantic signal-root tokens now exist, declared in :root", () => {
    const SIGNAL_TOKENS = [
      "--sig-identity", "--sig-infra", "--sig-financial",
      "--sig-temporal", "--sig-linguistic", "--sig-social",
    ];
    const missing = SIGNAL_TOKENS.filter((t) => !GLOBALS.includes(t));
    expect(missing).toEqual([]);
  });

  it("the type pair is drawn independently of the skin", () => {
    // Previously each skin pinned --font-disp, so type could only change when
    // the palette did. The pair is its own draw now, and its blocks come after
    // the skin blocks so they win at equal specificity.
    for (const f of [0, 1, 2]) expect(GLOBALS).toContain(`html[data-font="${f}"]`);
    expect(GLOBALS.indexOf('html[data-font="0"]')).toBeGreaterThan(
      GLOBALS.indexOf('html[data-skin="arctic"]')
    );
  });
});
