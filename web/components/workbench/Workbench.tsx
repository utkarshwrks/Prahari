"use client";

import { useState } from "react";
import ActorList from "./ActorList";
import ActorProfileView from "./ActorProfile";
import AuditPanel from "./AuditPanel";
import TimingPanel from "./TimingPanel";
import ChainPanel from "./ChainPanel";
import EvidenceTrail from "./EvidenceTrail";
import Header from "./Header";

/**
 * Three columns, in the order an investigation actually moves:
 *   who are the candidates → what do we know about this one → how sure, and can we prove it.
 *
 * Below 1280px it becomes two columns, below 900px one — the profile stays
 * first, because it is the only column that is useless without the others.
 */
export default function Workbench() {
  const [actorId, setActorId] = useState<string | null>(null);
  const [pairId, setPairId] = useState<string | null>(null);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg)]">
      <Header />
      <main className="grid min-h-0 flex-1 gap-2 overflow-y-auto p-2 lg:grid-cols-[300px_1fr] xl:grid-cols-[300px_1fr_380px] xl:overflow-hidden">
        <div className="min-h-[340px] lg:min-h-0">
          <ActorList
            selected={actorId}
            onSelect={(id) => { setActorId(id); setPairId(null); }}
          />
        </div>

        <div className="min-h-[520px] min-w-0 xl:min-h-0">
          <ActorProfileView actorId={actorId} onOpenPair={setPairId} />
        </div>

        <div className="slim flex min-h-0 min-w-0 flex-col gap-2 xl:overflow-y-auto">
          <div className="min-h-[460px] shrink-0">
            <EvidenceTrail pairId={pairId} />
          </div>
          <div className="min-h-[300px] shrink-0">
            <TimingPanel />
          </div>
          <div className="min-h-[300px] shrink-0">
            <ChainPanel />
          </div>
          <div className="min-h-[380px] shrink-0">
            <AuditPanel />
          </div>
        </div>
      </main>
    </div>
  );
}
