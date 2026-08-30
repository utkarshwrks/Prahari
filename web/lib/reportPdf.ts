/**
 * A one-page, print-clean actor attribution report as a real vector PDF.
 *
 * Deliberately NOT skin-themed: a report that leaves the building should look
 * the same every time, so it uses one fixed professional palette. Vector text
 * (jsPDF primitives) keeps it crisp at any zoom and tiny on disk.
 */
import { jsPDF } from "jspdf";
import type { ActorProfile } from "./api";

const INK = [18, 20, 26] as const;
const MUTED = [110, 116, 128] as const;
const FAINT = [176, 181, 190] as const;
const ACCENT = [232, 80, 58] as const;
const AMBER = [193, 138, 43] as const;
const PANEL = [244, 245, 248] as const;
const LINE = [223, 226, 231] as const;
const WHITE = [255, 255, 255] as const;

const short = (v: string, n = 40) => (v.length > n ? `${v.slice(0, n - 8)}…${v.slice(-6)}` : v);
const dt = (s: string | null) => (s ? s.slice(0, 10) : "—");

export function buildActorReportPdf(p: ActorProfile): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, H = 210, M = 12;
  const conf = p.attribution_confidence;

  // ---- header band ------------------------------------------------------
  doc.setFillColor(...INK); doc.rect(0, 0, W, 22, "F");
  doc.setFillColor(...ACCENT); doc.rect(0, 22, W, 1.1, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text("PRAHARI", M, 11);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  doc.setTextColor(190, 193, 200);
  doc.text("THREAT ACTOR ATTRIBUTION REPORT", M, 16.5);
  doc.setFontSize(7);
  const stamp = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  doc.text(`Generated ${stamp}`, W - M, 10, { align: "right" });
  doc.text(`Case ref  ${p.actor_id.toUpperCase()}`, W - M, 15, { align: "right" });
  doc.text("CONFIDENTIAL · calibrated attribution", W - M, 19.5, { align: "right" });

  // ---- left: identity + confidence -------------------------------------
  let y = 34;
  doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(24);
  doc.text(p.label, M, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...MUTED);
  doc.text(`${p.actor_id}   ·   ${p.personas.length} personas   ·   ${p.post_count} posts`, M, y + 6);

  // confidence block (right of header area)
  const cx = W - M - 74;
  doc.setDrawColor(...LINE); doc.setLineWidth(0.3);
  doc.roundedRect(cx, 27, 74, 26, 2, 2, "S");
  doc.setFontSize(6.5); doc.setTextColor(...MUTED);
  doc.text("ATTRIBUTION CONFIDENCE", cx + 5, 33.5);
  const [cr, cg, cb] = conf == null ? MUTED : conf >= 0.75 ? ACCENT : conf >= 0.4 ? AMBER : FAINT;
  doc.setTextColor(cr, cg, cb); doc.setFont("helvetica", "bold"); doc.setFontSize(26);
  doc.text(conf == null ? "—" : conf.toFixed(3), cx + 5, 46);
  // gauge
  const gx = cx + 40, gw = 29;
  doc.setFillColor(...PANEL); doc.roundedRect(gx, 41, gw, 3, 1.5, 1.5, "F");
  doc.setFillColor(cr, cg, cb);
  doc.roundedRect(gx, 41, Math.max(1.5, gw * (conf ?? 0)), 3, 1.5, 1.5, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(6); doc.setTextColor(...MUTED);
  doc.text("root-collapsed · reliability-dampened", gx, 49);

  y = 47;
  doc.setFontSize(7.5); doc.setTextColor(...INK);
  const basis = doc.splitTextToSize(p.confidence_basis || "", 150);
  doc.text(basis.slice(0, 3), M, y);
  y += basis.slice(0, 3).length * 4 + 2;

  if (p.flags.length) {
    doc.setFillColor(253, 237, 234); doc.setDrawColor(...ACCENT); doc.setLineWidth(0.3);
    doc.roundedRect(M, y, 150, 8, 1.5, 1.5, "FD");
    doc.setTextColor(...ACCENT); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
    doc.text("COUNTER-DECEPTION FLAGS", M + 3, y + 3.4);
    doc.setFont("helvetica", "normal"); doc.setTextColor(...INK);
    doc.text(p.flags.join("  ·  "), M + 3, y + 6.4);
    y += 12;
  } else { y += 2; }

  // ---- stat strip -------------------------------------------------------
  const stats: [string, string][] = [
    ["MARKETS", p.markets.join(", ") || "—"],
    ["CATEGORIES", p.categories.join(", ") || "—"],
    ["ACTIVE", `${dt(p.first_seen)} → ${dt(p.last_seen)}`],
    ["LAST SCAN", (p.last_scan ?? "—").replace("T", " ").slice(0, 16)],
  ];
  const sw = (150 - 3 * 3) / 4;
  stats.forEach((s, i) => {
    const x = M + i * (sw + 3);
    doc.setFillColor(...PANEL); doc.roundedRect(x, y, sw, 13, 1.5, 1.5, "F");
    doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(5.6);
    doc.text(s[0], x + 2.5, y + 4.2);
    doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
    doc.text(doc.splitTextToSize(s[1], sw - 5).slice(0, 2), x + 2.5, y + 8.4);
  });
  y += 18;

  // ---- section helper ---------------------------------------------------
  const sectionHead = (title: string, x: number, yy: number, w: number) => {
    doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(x, yy, x + w, yy);
    doc.setTextColor(...ACCENT); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
    doc.text(title.toUpperCase(), x, yy + 4.5);
    return yy + 8;
  };

  // ---- LEFT column: personas + linkages --------------------------------
  const colW = 138;
  let ly = sectionHead("Personas", M, y, colW);
  doc.setFontSize(7);
  p.personas.slice(0, 6).forEach((s) => {
    doc.setTextColor(...INK); doc.setFont("helvetica", "bold");
    doc.text(s.handle, M, ly);
    doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTED);
    doc.text(`@${s.market}`, M + doc.getTextWidth(s.handle) + 2, ly);
    doc.text(`${s.post_count} posts`, M + colW, ly, { align: "right" });
    doc.setTextColor(...FAINT); doc.setFontSize(6);
    doc.text(`${dt(s.first_seen)} → ${dt(s.last_seen)}   ${s.categories.join(", ")}`, M, ly + 3.4);
    doc.setFontSize(7);
    ly += 7.5;
  });

  ly = sectionHead("Persona linkages", M, ly + 2, colW);
  doc.setFontSize(6.8);
  (p.linkages.length ? p.linkages.slice(0, 5) : []).forEach((l) => {
    doc.setTextColor(...INK); doc.setFont("helvetica", "normal");
    doc.text(`${l.persona_a}  ↔  ${l.persona_b}`, M, ly);
    const lc = l.confidence >= 0.75 ? ACCENT : MUTED;
    doc.setTextColor(lc[0], lc[1], lc[2]); doc.setFont("helvetica", "bold");
    doc.text(l.confidence.toFixed(2), M + colW, ly, { align: "right" });
    ly += 4.6;
  });
  if (!p.linkages.length) { doc.setTextColor(...FAINT); doc.text("Single persona — nothing to link.", M, ly); }

  // ---- RIGHT column: identifiers + infrastructure ----------------------
  const rx = M + colW + 9;
  let ry = sectionHead("Identifiers", rx, y, colW);
  doc.setFontSize(6.8);
  if (!p.identifiers.length) {
    doc.setTextColor(...FAINT); doc.text("None recovered — held together by style and timing.", rx, ry);
    ry += 5;
  }
  p.identifiers.slice(0, 8).forEach((i) => {
    const ic = i.shared ? ACCENT : MUTED; doc.setTextColor(ic[0], ic[1], ic[2]); doc.setFont("helvetica", "bold"); doc.setFontSize(5.6);
    doc.text(i.kind.toUpperCase(), rx, ry);
    doc.setTextColor(...INK); doc.setFont("helvetica", "normal"); doc.setFontSize(6.8);
    doc.text(short(i.value, 42), rx + 16, ry);
    if (i.shared) {
      doc.setTextColor(...ACCENT); doc.setFontSize(5.6);
      doc.text(`shared ×${i.personas.length}`, rx + colW, ry, { align: "right" });
    }
    ry += 5;
  });

  ry = sectionHead("Infrastructure indicators", rx, ry + 2, colW);
  doc.setFontSize(6.8);
  if (!p.infrastructure.length) {
    doc.setTextColor(...FAINT); doc.text("No clearnet pivot recovered.", rx, ry);
  }
  p.infrastructure.slice(0, 4).forEach((x) => {
    doc.setTextColor(...INK); doc.setFont("helvetica", "bold");
    doc.text(x.clearnet_host, rx, ry);
    doc.setTextColor(...ACCENT);
    doc.text(x.strength.toFixed(2), rx + colW, ry, { align: "right" });
    doc.setTextColor(...FAINT); doc.setFont("helvetica", "normal"); doc.setFontSize(6);
    doc.text(short(x.evidence[0]?.detail ?? "", 62), rx, ry + 3.2);
    doc.setFontSize(6.8);
    ry += 7;
  });

  // ---- footer -----------------------------------------------------------
  doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, H - 12, W - M, H - 12);
  doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(6);
  doc.text(`Sources: ${p.sources.join(", ") || "—"}`, M, H - 7.5);
  doc.text("PRAHARI · प्रहरी · calibrated attribution with a published false-merge rate · figures reproducible with python -m engine.fusion.eval",
    M, H - 4);
  doc.text("Attribution is correlation of public footprints, not surveillance. Confidence is a calibrated probability, not a verdict.",
    W - M, H - 7.5, { align: "right" });
  return doc;
}

export function downloadActorReport(p: ActorProfile) {
  const doc = buildActorReportPdf(p);
  doc.save(`PRAHARI_${p.actor_id}_report.pdf`);
}
