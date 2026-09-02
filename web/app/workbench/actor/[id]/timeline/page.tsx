"use client";

import ActorRoute from "@/components/workspace/ActorRoute";
import ActorTimeline from "@/components/workbench/ActorTimeline";

/**
 * Per-persona timeline. NOT aggregated -- summing hides the
 * one-goes-quiet-as-another-appears shape that is a rebrand, which is the whole
 * reason this panel exists.
 */
export default function Page({ params }: { params: { id: string } }) {
  return (
    <ActorRoute actorId={params.id}>
      {({ timeline }) =>
        timeline ? (
          <div className="glass p-3">
            <ActorTimeline timeline={timeline} />
          </div>
        ) : (
          <div className="glass p-4">
            <p className="mono text-[10px] text-[var(--muted-2)]">
              Timeline not available for this actor — the engine returned no series.
            </p>
          </div>
        )
      }
    </ActorRoute>
  );
}
