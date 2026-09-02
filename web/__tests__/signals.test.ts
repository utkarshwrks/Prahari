/**
 * SEMANTIC COLOUR IS NOT SKIN COLOUR — the Phase 1 gate (DEC-055).
 *
 * A skin may change palette, type and shape. It may NOT change a colour that
 * encodes meaning: in the relationship graph colour IS the entity type, on the
 * evidence trail colour IS the signal root. If those move when the skin is
 * redrawn, the analyst's mental map of the evidence moves with them.
 *
 * The bug underneath the skin bug: every signal root was drawn with
 * `linear-gradient(var(--accent-dim), var(--accent))`. All six roots shared one
 * colour, and that colour was skin-dependent -- so the one thing colour carried
 * on the trail was the one thing guaranteed to change.
 *
 * This file asserts the separation, over the real stylesheet.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SIGNAL_COLOR,
  SIGNAL_LABEL,
  SIGNAL_ROOTS,
  ENTITY_COLOR,
  ENTITY_COLOR_HEX,
  ENTITY_KINDS,
  signalVar,
  entityVar,
} from "@/lib/signals";
import { SKINS } from "@/lib/skins";

const CSS = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

/** Every `html[data-skin="…"] { … }` block, keyed by skin id. */
function skinBlocks(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of CSS.matchAll(/html\[data-skin="([a-z]+)"\]\s*\{([^}]*)\}/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

/** The `:root { … }` block. */
function rootBlock(): string {
  const start = CSS.indexOf(":root {");
  return CSS.slice(start, CSS.indexOf("\n}", start));
}

const SEMANTIC_VARS = [
  ...SIGNAL_ROOTS.map(signalVar),
  ...ENTITY_KINDS.map(entityVar),
];

describe("the semantic tokens exist", () => {
  it("declares all six signal roots", () => {
    expect(SIGNAL_ROOTS.sort()).toEqual(
      ["financial", "identity_key", "infra", "linguistic", "social", "temporal"].sort()
    );
  });

  it("names the tokens the playbook names", () => {
    expect(SIGNAL_ROOTS.map(signalVar).sort()).toEqual([
      "--sig-financial",
      "--sig-identity",
      "--sig-infra",
      "--sig-linguistic",
      "--sig-social",
      "--sig-temporal",
    ]);
  });

  it("defines every semantic token in :root", () => {
    const root = rootBlock();
    const missing = SEMANTIC_VARS.filter((v) => !root.includes(`${v}:`));
    expect(missing).toEqual([]);
  });

  it("gives every signal root a label as well as a colour", () => {
    for (const r of SIGNAL_ROOTS) {
      expect(SIGNAL_LABEL[r]).toBeTruthy();
      expect(SIGNAL_COLOR[r]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

/**
 * THE GATE. Six skins, and not one of them may touch a semantic token.
 *
 * Asserted structurally rather than by rendering the legend under each skin:
 * a CSS custom property that is never redefined in any skin block is identical
 * across skins by construction, which is a stronger statement than six
 * screenshots agreeing. The e2e walk covers the rendered half.
 */
describe("no skin may redefine a semantic token", () => {
  it("found all six skin blocks in the stylesheet", () => {
    const blocks = skinBlocks();
    expect(Object.keys(blocks).sort()).toEqual(SKINS.map((s) => s.id).sort());
  });

  it.each(SKINS.map((s) => s.id))("skin %s redefines no --sig-* token", (id) => {
    const block = skinBlocks()[id];
    const offenders = SIGNAL_ROOTS.map(signalVar).filter((v) => block.includes(v));
    expect(offenders).toEqual([]);
  });

  it.each(SKINS.map((s) => s.id))("skin %s redefines no --ent-* token", (id) => {
    const block = skinBlocks()[id];
    const offenders = ENTITY_KINDS.map(entityVar).filter((v) => block.includes(v));
    expect(offenders).toEqual([]);
  });

  it("no semantic token appears anywhere inside a data-skin selector", () => {
    // Belt and braces: catches a token added under a nested or combined
    // selector that the per-block scan above would miss.
    const skinScoped = [...CSS.matchAll(/html\[data-skin="[a-z]+"\][^{]*\{([^}]*)\}/g)]
      .map((m) => m[1])
      .join("\n");
    const offenders = SEMANTIC_VARS.filter((v) => skinScoped.includes(v));
    expect(offenders).toEqual([]);
  });

  it("semantic tokens are declared exactly once each", () => {
    for (const v of SEMANTIC_VARS) {
      const declarations = CSS.split(`${v}:`).length - 1;
      expect(declarations, `${v} declared ${declarations} times`).toBe(1);
    }
  });
});

describe("the stylesheet and the TypeScript registry agree", () => {
  it.each(SIGNAL_ROOTS)("--sig for %s matches SIGNAL_COLOR", (root) => {
    const decl = new RegExp(`${signalVar(root)}:\\s*(#[0-9a-fA-F]{6})`).exec(CSS);
    expect(decl?.[1]?.toLowerCase()).toBe(SIGNAL_COLOR[root].toLowerCase());
  });

  it.each(ENTITY_KINDS)("--ent for %s matches ENTITY_COLOR", (kind) => {
    const decl = new RegExp(`${entityVar(kind)}:\\s*(#[0-9a-fA-F]{6})`).exec(CSS);
    expect(decl?.[1]?.toLowerCase()).toBe(ENTITY_COLOR[kind].toLowerCase());
  });

  it("the three.js integers derive from the same literals as the hex", () => {
    // The 3D view and the DOM legend drew from two hand-copied lists before
    // DEC-055. One source now, converted, so they cannot drift.
    for (const kind of ENTITY_KINDS) {
      expect(ENTITY_COLOR_HEX[kind]).toBe(Number.parseInt(ENTITY_COLOR[kind].slice(1), 16));
    }
  });
});

describe("the components read the registry, not literals", () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

  it("the evidence trail no longer paints every root with the accent", () => {
    const src = read("components/workbench/EvidenceTrail.tsx");
    expect(src).not.toContain("linear-gradient(90deg, var(--accent-dim), var(--accent))");
    expect(src).toContain("signalVar");
  });

  it("the graph legend and the 3D view import the shared registry", () => {
    expect(read("components/workbench/ActorGraphPanel.tsx")).toContain("@/lib/signals");
    expect(read("components/three/ActorGraph3D.tsx")).toContain("@/lib/signals");
  });

  it("no component hardcodes a semantic hex any more", () => {
    const literals = Object.values(ENTITY_COLOR).map((h) => h.toLowerCase());
    for (const f of [
      "components/workbench/ActorGraphPanel.tsx",
      "components/three/ActorGraph3D.tsx",
    ]) {
      const src = read(f).toLowerCase();
      // The registry import supplies these; a literal here is a copy that can
      // drift. Decorative constants are exempt but must be NAMED as such --
      // ActorGraph3D's RIM_LIGHT shares a value with --ent-email by
      // coincidence, and the name is what stops that reading as a link.
      const body = src.replace(/^const rim_light = 0x[0-9a-f]{6};$/gim, "");
      const found = literals.filter((h) => body.includes(`"${h}"`) || body.includes(`0x${h.slice(1)}`));
      expect(found, `${f} still hardcodes ${found.join(", ")}`).toEqual([]);
    }
  });
});

/**
 * INV-11: motion is gated, information is not -- and the same holds for colour.
 * A reader who cannot distinguish these colours must lose nothing, so every
 * colour-coded row also carries its label.
 */
describe("colour is never the only channel", () => {
  it("every signal root has a text label beside its swatch", () => {
    const src = readFileSync(join(process.cwd(), "components/workbench/EvidenceTrail.tsx"), "utf8");
    expect(src).toContain("ROOT_LABEL[root]");
    // The swatch is decorative; the label is the information.
    expect(src).toContain('aria-hidden="true"');
  });
});
