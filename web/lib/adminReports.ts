/**
 * COMMAND PANEL REPORTS (DEC-060).
 *
 * Four new reports, built on the EXISTING `lib/report.ts` path. The three
 * NTRO-mandated formats (`/export/case/{id}.json|.csv|.pdf`) and the one-page
 * vector report in `lib/reportPdf.ts` are untouched and still reachable.
 *
 * Three rules, all inherited rather than reinvented:
 *
 *   1. NO HTML STRING TEMPLATING, however convenient. Every node is built with
 *      `createElement` + `textContent` through `openReport` (INV-6,
 *      FINDING-02). A report is where analyst-authored and market-sourced text
 *      meets a rendering surface, which is exactly where the original bug was.
 *   2. A FIXED LIGHT PALETTE, not the app skin. What the reader sees is what
 *      leaves the building, and a report that arrives in a different colour
 *      scheme each time is a report nobody can cite.
 *   3. EVERY REPORT CARRIES ITS PROVENANCE: the Merkle root, the transaction
 *      hash and chain id WHEN a public anchor exists, engine version, generation
 *      time, and the standing honesty statement. An anchor line appears only
 *      when there is a public anchor -- silence there would let a reader assume
 *      a local seal was a public one.
 */
import { openReport, type ReportSpec } from "./report";

export const HONESTY_STATEMENT =
  "PRAHARI correlates footprints operators published themselves. It does not break Tor, " +
  "scrape live marketplaces, probe target hosts, or claim certainty. Every score is calibrated " +
  "and reproduces from its evidence trail.";

export interface ReportProvenance {
  merkleRoot: string | null;
  /** Present only when a seal reached a PUBLIC chain. */
  anchor: { txHash: string; chainId: number; explorerUrl: string | null } | null;
  engineVersion: string | null;
  generatedBy: string;
}

/**
 * The subtitle every report carries.
 *
 * Built as one string because `openReport` renders it with `textContent`, so it
 * cannot become markup. The anchor clause is present or absent -- never a
 * placeholder, and never "anchor: none", which reads like a field that failed
 * rather than a fact that is not true.
 */
export function provenanceSubtitle(p: ReportProvenance): string {
  const parts = [
    `Generated ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC by ${p.generatedBy}`,
    `Engine ${p.engineVersion ?? "version not reported"}`,
    p.merkleRoot ? `Merkle root ${p.merkleRoot}` : "Merkle root not available",
  ];
  if (p.anchor) {
    parts.push(`Anchored on chain ${p.anchor.chainId}, tx ${p.anchor.txHash}`);
  } else {
    // Stated, not omitted. A reader who sees nothing about anchoring may assume
    // there was one; this says there was not.
    parts.push("No public anchor — any seal on this case is local only");
  }
  parts.push(HONESTY_STATEMENT);
  return parts.join(" · ");
}

const str = (v: unknown): string =>
  v === null || v === undefined ? "not recorded" : typeof v === "object" ? JSON.stringify(v) : String(v);

export interface ActorRow {
  actor_id: string;
  label: string;
  attribution_confidence: number | null;
  override?: boolean;
  override_reason?: string | null;
  markets?: string[];
}

/** Multi-actor case report. */
export function multiActorReport(
  caseId: string,
  actors: ActorRow[],
  p: ReportProvenance
): boolean {
  const spec: ReportSpec<ActorRow> = {
    title: `PRAHARI case report — ${caseId}`,
    subtitle: provenanceSubtitle(p),
    theme: "print",
    emptyMessage: "No actors are attached to this case.",
    columns: [
      { header: "Actor", value: (r) => r.label },
      { header: "Id", value: (r) => r.actor_id },
      {
        header: "Attribution confidence",
        value: (r) =>
          // "not measured" and "0.000" are different claims (INV-5).
          r.attribution_confidence === null ? "not measured" : r.attribution_confidence.toFixed(3),
      },
      {
        header: "Analyst override",
        value: (r) =>
          r.override
            ? `YES — ${r.override_reason ?? "no reason recorded"}`
            : "no",
      },
      { header: "Markets", value: (r) => (r.markets ?? []).join(", ") || "not recorded" },
    ],
    rows: actors,
  };
  return openReport(spec);
}

export interface ActivityRow {
  seq: number;
  ts: string;
  actor: string;
  action: string;
  payload: unknown;
  hash: string;
  prev_hash: string;
  signed: boolean;
}

/**
 * Audit report: who did what, and whether the chain verifies.
 *
 * `chainVerified` is passed in rather than computed here, because the engine
 * is what verifies the chain and a second implementation could report a
 * different answer -- which is DEC-038's lesson exactly.
 */
export function auditReport(
  rows: ActivityRow[],
  p: ReportProvenance,
  chainVerified: { ok: boolean; failingIndex: number | null; reason: string | null }
): boolean {
  const verdict = chainVerified.ok
    ? "Chain verified: every record hashes to its successor and every signature checks."
    : `CHAIN VERIFICATION FAILED at record ${chainVerified.failingIndex ?? "unknown"} — ${
        chainVerified.reason ?? "no reason reported"
      }. Treat every record after that point as unverified.`;

  return openReport<ActivityRow>({
    title: "PRAHARI audit report",
    // The verdict leads the subtitle: a failed chain is the first thing a
    // reader must see, not a footnote under a table they may not reach.
    subtitle: `${verdict} · ${provenanceSubtitle(p)}`,
    theme: "print",
    emptyMessage: "No administrative actions have been recorded.",
    columns: [
      { header: "#", value: (r) => String(r.seq) },
      { header: "When (UTC)", value: (r) => r.ts.replace("T", " ").slice(0, 19) },
      { header: "Who", value: (r) => r.actor },
      { header: "Action", value: (r) => r.action },
      { header: "Detail", value: (r) => str(r.payload) },
      { header: "Signed", value: (r) => (r.signed ? "yes" : "NO — unsigned") },
      { header: "Hash", value: (r) => r.hash },
    ],
    rows,
  });
}

export interface SourceRow {
  name: string;
  kind: string;
  requires_key: boolean;
  key_present: boolean;
  freshness_s: number | null;
  items_24h: number;
}

/** Source-health report. Never renders a key value — only whether one is set. */
export function sourceHealthReport(sources: SourceRow[], p: ReportProvenance): boolean {
  return openReport<SourceRow>({
    title: "PRAHARI source-health report",
    subtitle: provenanceSubtitle(p),
    theme: "print",
    emptyMessage: "No sources are configured.",
    columns: [
      { header: "Source", value: (r) => r.name },
      { header: "Kind", value: (r) => r.kind },
      {
        header: "Credential",
        value: (r) =>
          // A report is the last place a key should ever appear. Presence only.
          !r.requires_key ? "keyless" : r.key_present ? "key present" : "NO KEY — source disabled",
      },
      {
        header: "Last scan",
        value: (r) =>
          r.freshness_s === null
            ? "never scanned"
            : `${Math.round(r.freshness_s / 60)} minutes ago`,
      },
      { header: "Items in 24h", value: (r) => String(r.items_24h) },
    ],
    rows: sources,
  });
}

export interface PeriodRow {
  label: string;
  value: string;
  definition: string;
}

/** Period report: activity, new links, verdicts and seals over a window. */
export function periodReport(
  from: string,
  to: string,
  rows: PeriodRow[],
  p: ReportProvenance
): boolean {
  return openReport<PeriodRow>({
    title: `PRAHARI period report — ${from} to ${to}`,
    subtitle: provenanceSubtitle(p),
    theme: "print",
    emptyMessage: "Nothing was measured for this period.",
    columns: [
      { header: "Measure", value: (r) => r.label },
      { header: "Value", value: (r) => r.value },
      // Every figure carries its definition, so no number in a report that
      // leaves the building is unexplained.
      { header: "How it is measured", value: (r) => r.definition },
    ],
    rows,
  });
}
