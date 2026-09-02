"use client";

import ActorRoute from "@/components/workspace/ActorRoute";
import ActorProfileView from "@/components/workbench/ActorProfile";

/**
 * Actor dossier — profile, identifiers, personas, provenance, at full width.
 * Reuses ActorProfile unchanged; the workspace gives it the room it never had
 * in the cockpit's bottom-left quadrant.
 */
export default function Page({ params }: { params: { id: string } }) {
  return (
    <ActorRoute actorId={params.id}>
      {({ profile, timeline }) => (
        <div className="h-full min-h-[70vh]">
          <ActorProfileView
            actorId={profile.actor_id}
            profile={profile}
            timeline={timeline}
            err={null}
            onOpenPair={(pairId) => {
              // Deep-link the pair into the evidence route rather than opening a
              // drawer: the trail is the courtroom view and deserves the page.
              window.location.assign(
                `/workbench/actor/${profile.actor_id}/evidence?pair=${encodeURIComponent(pairId)}`
              );
            }}
          />
        </div>
      )}
    </ActorRoute>
  );
}
