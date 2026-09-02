"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import ActorRoute from "@/components/workspace/ActorRoute";
import EvidenceTrail from "@/components/workbench/EvidenceTrail";

/**
 * The evidence trail at full width, printable.
 *
 * `?pair=` is part of the URL, not component state, so an analyst can paste a
 * link to one specific linkage's arithmetic and a colleague lands on exactly
 * that trail (DEC-056, deep-linkable state).
 */
function EvidenceBody({ actorId }: { actorId: string }) {
  const params = useSearchParams();
  const pairId = params.get("pair");
  return (
    <ActorRoute actorId={actorId}>
      {({ profile }) => (
        <div className="space-y-3">
          <div className="glass max-h-none p-0">
            <EvidenceTrail pairId={pairId} />
          </div>
          {!pairId && profile.linkages.length > 0 && (
            <p className="mono px-1 text-[9px] leading-relaxed text-[var(--muted-2)]">
              Showing the worked example. Open a linkage from the dossier or the graph to see the
              arithmetic for that specific pair.
            </p>
          )}
        </div>
      )}
    </ActorRoute>
  );
}

export default function Page({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<p className="mono p-4 text-[10px] text-[var(--muted-2)]">Loading…</p>}>
      <EvidenceBody actorId={params.id} />
    </Suspense>
  );
}
