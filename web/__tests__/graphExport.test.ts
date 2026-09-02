/**
 * Graph exports carry provenance, and are built without string templating.
 *
 * AN EXHIBIT WITH NO PROVENANCE IS NOT AN EXHIBIT. A PNG of a filtered graph
 * with no record of the filter is a picture nobody can challenge — an opposing
 * expert cannot reproduce it, and neither can the analyst who made it three
 * months later.
 *
 * The GraphML writer is also the one place a hostile actor label would land
 * inside markup, so FINDING-02 applies here as much as it does to reports.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildModel, DEFAULT_FILTERS, type GraphFilters } from "@/lib/graphModel";
import {
  exportName, provenanceLine, provenanceOf, toGraphML, toJSON,
} from "@/lib/graphExport";
import type { ActorProfile } from "@/lib/api";

const profile = (over: Partial<ActorProfile> = {}): ActorProfile => ({
  ok: true,
  actor_id: "actor-088",
  label: "nightowl1",
  personas: [
    { id: "p0", handle: "nightowl1", market: "AlphaBay", first_seen: "2026-01-04", last_seen: "2026-03-28", post_count: 12, categories: [], role: "vendor" },
  ],
  identifiers: [{ kind: "pgp", value: "8B93A224231030CDA99ECB", personas: ["p0"], shared: false }],
  infrastructure: [],
  linkages: [],
  attribution_confidence: 0.991,
  confidence_basis: "x",
  categories: [],
  markets: [],
  first_seen: null,
  last_seen: null,
  last_scan: null,
  sources: [],
  post_count: 12,
  flags: [],
  ...over,
});

const filters: GraphFilters = {
  ...DEFAULT_FILTERS,
  roots: ["identity_key"],
  minStrength: 0.4,
  showInferred: false,
};

const model = buildModel(profile());
const prov = provenanceOf(model, "force2d", filters, "prahari-engine 2.0.0");

describe("provenance", () => {
  it("records the actor, the view, the engine version and a UTC timestamp", () => {
    expect(prov.actorId).toBe("actor-088");
    expect(prov.actorLabel).toBe("nightowl1");
    expect(prov.view).toBe("force2d");
    expect(prov.engineVersion).toBe("prahari-engine 2.0.0");
    expect(prov.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  });

  it("says so plainly when the engine did not report a version", () => {
    // INV-5: an export claiming a version the engine never stated would be a
    // fabricated provenance record, which is worse than an absent one.
    expect(provenanceOf(model, "matrix", filters, null).engineVersion).toBe(
      "not reported by the engine"
    );
  });

  it("the one-line summary carries the complete filter state", () => {
    const line = provenanceLine(prov);
    expect(line).toContain("actor=actor-088");
    expect(line).toContain("view=force2d");
    expect(line).toContain("identity_key");
    expect(line).toContain("min_strength=0.4");
    expect(line).toContain("inferred=hidden");
    expect(line).toContain("engine=prahari-engine 2.0.0");
    expect(line).toContain("generated=");
  });

  it("says 'all roots' rather than leaving the filter blank", () => {
    expect(provenanceLine(provenanceOf(model, "list", DEFAULT_FILTERS, "e"))).toContain("all roots");
  });

  it("names the file after the actor, the view and the time", () => {
    const name = exportName(prov, "svg");
    expect(name).toMatch(/^prahari-actor-088-force2d-\d{4}-\d{2}-\d{2}T[\d-]+\.svg$/);
  });
});

describe("JSON export", () => {
  const parsed = JSON.parse(toJSON(model, prov));

  it("embeds the provenance block", () => {
    expect(parsed.provenance.actorId).toBe("actor-088");
    expect(parsed.provenance.filters.minStrength).toBe(0.4);
  });

  it("carries the standing honesty statement about layout", () => {
    expect(parsed.honesty).toContain("Distance is meaningful");
    expect(parsed.honesty).toContain("inferred");
  });

  it("round-trips every node and edge", () => {
    expect(parsed.nodes).toHaveLength(model.nodes.length);
    expect(parsed.edges).toHaveLength(model.edges.length);
  });

  it("preserves the inferred flag, so the distinction survives leaving the tool", () => {
    const m = buildModel(
      profile({
        infrastructure: [{ clearnet_host: "cdn.test", strength: 0.8, evidence: [] }],
      })
    );
    const out = JSON.parse(toJSON(m, prov));
    expect(out.nodes.find((n: { kind: string }) => n.kind === "infra").inferred).toBe(true);
  });
});

describe("GraphML export (INV-6)", () => {
  const xml = toGraphML(model, prov);

  it("is well-formed GraphML with the provenance in its description", () => {
    expect(xml).toContain("graphml");
    expect(xml).toContain("actor=actor-088");
    expect(xml).toContain("edgedefault=\"undirected\"");
  });

  it("emits one node and one edge element per model item", () => {
    expect(xml.match(/<node /g) ?? []).toHaveLength(model.nodes.length);
    expect(xml.match(/<edge /g) ?? []).toHaveLength(model.edges.length);
  });

  /**
   * FINDING-02, in the export path. A label is market-sourced text; the old
   * report bug was exactly this shape. `textContent` and `setAttribute` cannot
   * produce markup no matter what the value contains.
   */
  it.each([
    `<script>alert(1)</script>`,
    `"><svg/onload=alert(1)>`,
    `]]><!--`,
    `<img src=x onerror=alert(1)>`,
    `" xmlns:evil="http://evil.test`,
  ])("renders a hostile label as escaped text, never as markup: %s", (payload) => {
    const hostile = buildModel(profile({ label: payload }));
    const out = toGraphML(hostile, prov);

    // Not one character of the payload survives as live markup...
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<svg");
    expect(out).not.toContain("]]>");
    // No namespace smuggled into ATTRIBUTE position. The payload's own quotes
    // are escaped inside the text node, so the substring can still appear
    // there -- harmlessly, as content. What must never happen is it becoming
    // an attribute on an element.
    expect(out).not.toMatch(/<[a-z]+[^>]*\sxmlns:evil=/);

    // ...and it IS present, escaped, so no information was silently dropped.
    const escaped = payload
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
    expect(out.includes(escaped) || out.includes(escaped.replace(/&quot;/g, '"'))).toBe(true);

    // Structure is unchanged by the payload: no injected or lost elements.
    expect(out.match(/<node /g) ?? []).toHaveLength(hostile.nodes.length);
  });

  /**
   * Well-formedness is NOT re-parsed here.
   *
   * happy-dom's DOMParser rejects `attr.name` / `attr.type` — the dot is legal
   * in an XML attribute name (NCName permits it) and GraphML mandates exactly
   * those two — so a re-parse fails on valid output. Asserting against it would
   * be testing happy-dom, not the exporter. DEC-042 is the standing reminder
   * that happy-dom is not a browser; the real-browser check lives in the e2e.
   */
  it("emits the GraphML attribute names the format mandates", () => {
    expect(xml).toContain('attr.name="label"');
    expect(xml).toContain('attr.type="string"');
  });

  it("interpolates no model data into markup (INV-6)", () => {
    const src = readFileSync(join(process.cwd(), "lib/graphExport.ts"), "utf8");
    expect(src).toContain("createElementNS");
    expect(src).toContain("XMLSerializer");

    // Every template literal in the CODE, checked for interpolation of graph
    // data. Comments are stripped first -- the prose in this file quotes
    // `createDocument` and mentions <html>, which a naive scan reads as an XML
    // template. The one XML-shaped literal that remains is the parser seed,
    // whose only substitution is the constant namespace: no node, label or
    // value may reach a string that becomes markup. That is how FINDING-02
    // happened once.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const xmlLiterals = [...code.matchAll(/`[^`]*<[a-z][^`]*`/g)].map((m) => m[0]);
    expect(xmlLiterals).toHaveLength(1);
    expect(xmlLiterals[0]).toContain("GRAPHML_NS");
    expect(xmlLiterals[0]).not.toMatch(/\$\{(?!GRAPHML_NS\})/);
  });
});
