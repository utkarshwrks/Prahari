"use client";

import { Suspense } from "react";
import ActorRoute from "@/components/workspace/ActorRoute";
import GraphLab from "@/components/graph/GraphLab";
import { FEATURES } from "@/lib/features";
import ActorGraphPanel from "@/components/workbench/ActorGraphPanel";

/**
 * The graph intelligence lab (DEC-057), behind NEXT_PUBLIC_FF_GRAPH_LAB.
 *
 * With the flag off this is the Phase 2 page: the existing ActorGraphPanel at
 * full viewport, unchanged. With it on, that same panel becomes the lab's
 * default view and ten more representations sit beside it.
 */
function Body({ actorId }: { actorId: string }) {
  return (
    <ActorRoute actorId={actorId}>
      {({ profile }) => {
        const openPair = (pairId: string) =>
          window.location.assign(
            `/workbench/actor/${profile.actor_id}/evidence?pair=${encodeURIComponent(pairId)}`
          );
        return FEATURES.graphLab ? (
          <GraphLab profile={profile} onOpenPair={openPair} />
        ) : (
          <div className="h-[calc(100vh-96px)] min-h-[420px]">
            <ActorGraphPanel profile={profile} fill onOpenPair={openPair} />
          </div>
        );
      }}
    </ActorRoute>
  );
}

export default function Page({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<p className="mono p-4 text-[10px] text-[var(--muted-2)]">Loading graph…</p>}>
      <Body actorId={params.id} />
    </Suspense>
  );
}
