"use client";

import AuditPanel from "@/components/workbench/AuditPanel";

/**
 * Case ledger — records, Merkle root, seal, proofs, verify.
 *
 * AuditPanel already carries the honesty rule this page depends on: no anchor
 * link when there is no public anchor. Silence there would let a viewer assume
 * a local seal was a public one.
 */
export default function Page({ params }: { params: { caseId: string } }) {
  return (
    <div className="space-y-3">
      <p className="mono px-1 text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
        Case {params.caseId}
      </p>
      <div className="glass">
        <AuditPanel />
      </div>
    </div>
  );
}
