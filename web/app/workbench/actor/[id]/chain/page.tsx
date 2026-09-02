"use client";

import ActorRoute from "@/components/workspace/ActorRoute";
import ChainPanel from "@/components/workbench/ChainPanel";

/** Chain flow — clusters, off-ramps, live BTC trace. */
export default function Page({ params }: { params: { id: string } }) {
  return (
    <ActorRoute actorId={params.id}>
      {() => (
        <div className="glass">
          <ChainPanel />
        </div>
      )}
    </ActorRoute>
  );
}
