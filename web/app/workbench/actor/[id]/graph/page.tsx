"use client";

import ActorRoute from "@/components/workspace/ActorRoute";
import ActorGraphPanel from "@/components/workbench/ActorGraphPanel";

/**
 * Graph lab, full viewport.
 *
 * Phase 3 builds the eleven graph kinds, the control column and the node
 * inspector here. This phase gives the existing 3D force graph the whole page,
 * which is objective 1 of that phase already met -- ActorGraphPanel and
 * ActorGraph3D are REUSED, not replaced.
 */
export default function Page({ params }: { params: { id: string } }) {
  return (
    <ActorRoute actorId={params.id}>
      {({ profile }) => (
        <div className="h-[calc(100vh-96px)] min-h-[420px]">
          <ActorGraphPanel
            profile={profile}
            fill
            onOpenPair={(pairId) =>
              window.location.assign(
                `/workbench/actor/${profile.actor_id}/evidence?pair=${encodeURIComponent(pairId)}`
              )
            }
          />
        </div>
      )}
    </ActorRoute>
  );
}
