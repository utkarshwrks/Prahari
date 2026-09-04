"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { Activity, LayoutDashboard, LogOut } from "lucide-react";
import { api, type EvalMetrics, type SourcesResult } from "@/lib/api";
import Logo from "../ui/Logo";
import { FEATURES } from "@/lib/features";

/**
 * The header carries the two facts an analyst needs to trust the screen:
 * whether autonomous collection is actually running, and what the system's
 * measured error rate is. Both come from the engine, not from constants.
 */
export default function Header() {
  const { data: session } = useSession();
  const [src, setSrc] = useState<SourcesResult | null>(null);
  const [m, setM] = useState<EvalMetrics | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await api.sources();
      if (alive && "ok" in s && s.ok) setSrc(s as SourcesResult);
      const mm = await api.metrics();
      if (alive && "ok" in mm && mm.ok) setM(mm as EvalMetrics);
    })();
    const id = setInterval(async () => {
      const s = await api.sources();
      if (alive && "ok" in s && s.ok) setSrc(s as SourcesResult);
    }, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const live = src?.scheduler?.running;

  return (
    <header className="hairline flex items-center justify-between gap-4 bg-[var(--surface)] px-4 py-2.5">
      <Logo />

      <div className="hidden items-center gap-5 md:flex">
        <span className="flex items-center gap-1.5" title="Autonomous collection">
          <Activity className={`h-3 w-3 ${live ? "text-[var(--ok)]" : "text-[var(--muted-2)]"}`} />
          <span className="mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
            {live ? "autonomous · on" : "autonomous · off"}
          </span>
        </span>

        {m && (
          <>
            <span className="h-4 w-px bg-[var(--border)]" />
            <span className="mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
              false-merge{" "}
              <span className="tnum text-[var(--text)]">
                {(m.false_merge_rate * 100).toFixed(1)}%
              </span>{" "}
              @ α={m.alpha}
            </span>
            <span className="mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
              ECE <span className="tnum text-[var(--text)]">{m.ece.toFixed(4)}</span>
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/*
          The way INTO the routed workspace (DEC-056). The cockpit is what
          /workbench renders, so without this button the ten routed views would
          be reachable only by typing a URL -- the rail's "Classic" link is the
          mirror of this one, and an escape hatch that only opens one way is a
          dead end.

          Behind the flag, because in a flag-off build the routed workspace does
          not exist. A button offering a view the build cannot render is worse
          than no button.
        */}
        {FEATURES.workspaceRoutes && (
          <a href="/workbench/overview" title="Workspace — the routed triage dashboard"
            className="mono hidden items-center gap-1 border border-[var(--border-2)] px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)] sm:inline-flex">
            <LayoutDashboard className="h-3 w-3" />
            Workspace
          </a>
        )}
        <a href="/sangam" title="Sangam — WHO x WHERE map"
          className="mono hidden items-center gap-1 border border-[var(--border-2)] px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)] sm:inline-flex">
          Sangam
        </a>
        <span className="mono hidden text-[10px] text-[var(--muted-2)] sm:inline">
          {session?.user?.name ?? session?.user?.email ?? "analyst"}
        </span>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          aria-label="Sign out"
          className="flex h-8 w-8 items-center justify-center border border-[var(--border)] text-[var(--muted-2)] transition hover:border-[var(--border-2)] hover:text-[var(--text)]"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </header>
  );
}
