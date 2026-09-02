/**
 * Graph exports (DEC-057).
 *
 * AN EXHIBIT WITH NO PROVENANCE IS NOT AN EXHIBIT.
 *
 * Every export carries the actor id, the complete filter state that produced
 * it, the view it came from, a UTC timestamp and the engine version. A PNG of a
 * filtered graph with no record of the filter is a picture that cannot be
 * challenged, which in a forensic tool is worse than no picture at all: an
 * opposing expert cannot reproduce it, and neither can the analyst who made it
 * three months later.
 *
 * Built with `createElement`/`textContent` and `XMLSerializer`, never string
 * templating (INV-6, FINDING-02) — the GraphML writer is the one place where a
 * hostile actor label would otherwise land inside markup.
 */
import type { GraphFilters, GraphModel } from "./graphModel";

export interface Provenance {
  actorId: string;
  actorLabel: string;
  view: string;
  filters: GraphFilters;
  engineVersion: string;
  generatedAt: string;
}

export function provenanceOf(
  model: GraphModel,
  view: string,
  filters: GraphFilters,
  engineVersion: string | null
): Provenance {
  return {
    actorId: model.actorId,
    actorLabel: model.label,
    view,
    filters,
    // "not reported" rather than a plausible default: an export claiming a
    // version the engine never stated is a fabricated provenance record.
    engineVersion: engineVersion ?? "not reported by the engine",
    generatedAt: new Date().toISOString(),
  };
}

/** One human-readable line, embedded in every export format. */
export function provenanceLine(p: Provenance): string {
  const f = p.filters;
  const roots = f.roots.length ? f.roots.join("+") : "all roots";
  return [
    `PRAHARI graph export`,
    `actor=${p.actorId} (${p.actorLabel})`,
    `view=${p.view}`,
    `filters=${roots}, min_strength=${f.minStrength}, inferred=${f.showInferred ? "shown" : "hidden"}, weak_linkages=${f.showWeakLinkages ? "shown" : "hidden"}`,
    `engine=${p.engineVersion}`,
    `generated=${p.generatedAt}`,
  ].join(" · ");
}

export function toJSON(model: GraphModel, p: Provenance): string {
  return JSON.stringify(
    {
      provenance: p,
      honesty:
        "Layout position is a consequence of edge strength. Distance is meaningful; absolute position is not. Nodes marked inferred were derived, not observed.",
      nodes: model.nodes,
      edges: model.edges,
    },
    null,
    2
  );
}

/**
 * GraphML, built as DOM.
 *
 * Node labels are analyst- and market-sourced strings. Interpolating them into
 * an XML template is the exact shape of FINDING-02; `textContent` and
 * `setAttribute` cannot produce markup no matter what the value contains.
 */
const GRAPHML_NS = "http://graphml.graphdrawing.org/xmlns";

export function toGraphML(model: GraphModel, p: Provenance): string {
  // Seeded through DOMParser rather than `createDocument`, and every element
  // created with `createElementNS`.
  //
  // Two reasons, both found by running this under happy-dom: `createDocument`
  // there yields an HTML document whose root is <html>, and declaring the
  // namespace with `setAttribute("xmlns", ...)` emits a SECOND xmlns attribute
  // beside the implicit one, which is malformed XML ("attributes construct
  // error"). Passing the namespace properly is also simply the correct API.
  const doc = new DOMParser().parseFromString(
    `<graphml xmlns="${GRAPHML_NS}"/>`,
    "application/xml"
  );
  const root = doc.documentElement;
  const create = (tag: string) => doc.createElementNS(GRAPHML_NS, tag);

  const desc = create("desc");
  desc.textContent = provenanceLine(p);
  root.appendChild(desc);

  for (const [id, name, forWhat] of [
    ["d_label", "label", "node"],
    ["d_kind", "kind", "node"],
    ["d_value", "value", "node"],
    ["d_inferred", "inferred", "node"],
    ["d_strength", "strength", "edge"],
    ["d_root", "root", "edge"],
    ["d_ekind", "kind", "edge"],
  ] as const) {
    const k = create("key");
    k.setAttribute("id", id);
    k.setAttribute("for", forWhat);
    k.setAttribute("attr.name", name);
    k.setAttribute("attr.type", "string");
    root.appendChild(k);
  }

  const g = create("graph");
  g.setAttribute("id", p.actorId);
  g.setAttribute("edgedefault", "undirected");
  root.appendChild(g);

  const data = (parent: Element, key: string, value: string) => {
    const d = create("data");
    d.setAttribute("key", key);
    d.textContent = value;
    parent.appendChild(d);
  };

  for (const n of model.nodes) {
    const el = create("node");
    el.setAttribute("id", n.id);
    data(el, "d_label", n.label);
    data(el, "d_kind", n.kind);
    data(el, "d_value", n.value);
    data(el, "d_inferred", String(n.inferred));
    g.appendChild(el);
  }
  for (const e of model.edges) {
    const el = create("edge");
    el.setAttribute("id", e.id);
    el.setAttribute("source", e.source);
    el.setAttribute("target", e.target);
    data(el, "d_strength", e.strength.toFixed(4));
    data(el, "d_root", e.root ?? "");
    data(el, "d_ekind", e.kind);
    g.appendChild(el);
  }

  return new XMLSerializer().serializeToString(doc);
}

/** Serialise a rendered SVG, stamping the provenance line into the file. */
export function toSVG(svg: SVGSVGElement, p: Provenance): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
  title.textContent = provenanceLine(p);
  clone.insertBefore(title, clone.firstChild);

  const meta = document.createElementNS("http://www.w3.org/2000/svg", "desc");
  meta.textContent = provenanceLine(p);
  clone.insertBefore(meta, clone.firstChild);

  // A visible footer, so the provenance survives someone screenshotting the SVG
  // rather than opening it.
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", "6");
  text.setAttribute("y", String((Number(clone.getAttribute("height")) || 400) - 6));
  text.setAttribute("font-size", "8");
  text.setAttribute("fill", "#8a8a94");
  text.setAttribute("font-family", "ui-monospace, monospace");
  text.textContent = provenanceLine(p);
  clone.appendChild(text);

  return new XMLSerializer().serializeToString(clone);
}

/** Rasterise an SVG string to a PNG data URL, provenance already baked in. */
export async function toPNG(svgText: string, width: number, height: number): Promise<string> {
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not rasterise the SVG."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width * 2; // 2x, so the exhibit is legible when printed
    canvas.height = height * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is unavailable in this browser.");
    ctx.fillStyle = "#0b0b0e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function download(filename: string, content: string, mime: string): void {
  const a = document.createElement("a");
  a.href = content.startsWith("data:")
    ? content
    : URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  if (!content.startsWith("data:")) setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Stable, sortable filename that names the actor and the view. */
export function exportName(p: Provenance, ext: string): string {
  const stamp = p.generatedAt.replace(/[:.]/g, "-").slice(0, 19);
  return `prahari-${p.actorId}-${p.view}-${stamp}.${ext}`;
}
