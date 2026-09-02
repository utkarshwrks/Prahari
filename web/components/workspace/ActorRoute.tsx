"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useActorEntry, useWorkspace } from "@/lib/workspace";
import type { ActorProfile, Timeline } from "@/lib/api";

/**
 * The wrapper every per-actor route uses (DEC-056).
 *
 * It does three things and nothing else: put the id into the workspace context,
 * ask the store to load it (which is a no-op when it is already cached), and
 * render one of three honest states.
 *
 * Centralised because the alternative -- each of the five actor routes writing
 * its own loading and error handling -- is how five routes end up disagreeing
 * about what "offline" looks like, and how one of them ends up fetching again.
 */
export default function ActorRoute({
  actorId,
  children,
}: {
  actorId: string;
  children: (data: { profile: ActorProfile; timeline: Timeline | null }) => React.ReactNode;
}) {
  const selectActor = useWorkspace((s) => s.selectActor);
  const loadActor = useWorkspace((s) => s.loadActor);
  const entry = useActorEntry(actorId);

  useEffect(() => {
    selectActor(actorId);
    void loadActor(actorId);
  }, [actorId, selectActor, loadActor]);

  if (entry.error) {
    return (
      <div className="glass p-4">
        <p className="mono text-[11px] text-[var(--text)]">
          {entry.error.kind === "offline" ? "Engine offline" : "Actor not available"}
        </p>
        <p className="mono mt-1 text-[10px] leading-relaxed text-[var(--muted-2)]">
          {entry.error.detail}
        </p>
        <Link
          href="/workbench/actors"
          className="mono mt-3 inline-block border border-[var(--border-2)] px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)]"
        >
          Back to actors
        </Link>
      </div>
    );
  }

  if (!entry.profile) {
    return (
      <div className="glass flex min-h-[240px] items-center justify-center p-4">
        <p className="mono text-[10px] text-[var(--muted-2)]">Loading {actorId}…</p>
      </div>
    );
  }

  return <>{children({ profile: entry.profile, timeline: entry.timeline })}</>;
}
