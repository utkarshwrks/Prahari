"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Activity, Command, FlaskConical, GitCompare, LayoutDashboard, LogOut, Network,
  ScrollText, ShieldCheck, Users, Waypoints,
} from "lucide-react";
import Logo from "../ui/Logo";
import { useWorkspace, useActorEntry, bandOf, BAND_LABEL } from "@/lib/workspace";
import { api, type EvalMetrics, type SourcesResult } from "@/lib/api";
import { useState } from "react";
import CommandPalette from "./CommandPalette";
import Breadcrumbs from "./Breadcrumbs";

/**
 * The workspace shell (DEC-056).
 *
 *   left    a slim navigator rail, persistent across routes and keyboard
 *           navigable, so the analyst never loses their place
 *   top     a context bar naming the current actor, its confidence and band,
 *           plus the two engine-sourced facts that used to live in Header
 *   centre  {children}
 *
 * The context bar's confidence is read from the store, NOT fetched here. Two
 * fetches for one number is how a screen ends up contradicting itself.
 */

const NAV = [
  { href: "/workbench", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/workbench/actors", label: "Actors", icon: Users },
  { href: "/workbench/compare", label: "Compare", icon: GitCompare },
  { href: "/workbench/tor", label: "Tor timing", icon: Waypoints },
  { href: "/workbench/case/CASE-001", label: "Case ledger", icon: ShieldCheck },
];

/** Per-actor tabs. Rendered only while an actor is selected. */
export const ACTOR_TABS = [
  { seg: "", label: "Dossier", icon: ScrollText },
  { seg: "/graph", label: "Graph", icon: Network },
  { seg: "/evidence", label: "Evidence", icon: ScrollText },
  { seg: "/timeline", label: "Timeline", icon: Activity },
  { seg: "/chain", label: "Chain", icon: FlaskConical },
];

export default function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const actorId = useWorkspace((s) => s.actorId);
  const rememberRoute = useWorkspace((s) => s.rememberRoute);
  const entry = useActorEntry(actorId);
  const [src, setSrc] = useState<SourcesResult | null>(null);
  const [metrics, setMetrics] = useState<EvalMetrics | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // The two engine-sourced facts move here from Header, and keep refreshing
  // from the engine every 30 s -- never from constants (INV-4).
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      const s = await api.sources();
      if (alive && "ok" in s && s.ok) setSrc(s as SourcesResult);
    };
    (async () => {
      await pull();
      const m = await api.metrics();
      if (alive && "ok" in m && m.ok) setMetrics(m as EvalMetrics);
    })();
    const id = setInterval(pull, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Remember the route per actor, so returning to a dossier restores the tab
  // the analyst left rather than resetting them to the top.
  useEffect(() => {
    if (actorId && pathname?.includes(`/actor/${actorId}`)) rememberRoute(actorId, pathname);
  }, [actorId, pathname, rememberRoute]);

  // Cmd/Ctrl-K anywhere in the workspace.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const profile = entry.profile;
  const confidence = profile?.attribution_confidence ?? null;
  const band = bandOf(confidence);
  const live = src?.scheduler?.running;

  // The classic cockpit renders its own Header and owns the full viewport.
  // Wrapping it would give it two headers and a nested scroll container, and
  // would invalidate the Phase 0 visual baseline, which is a picture of it.
  if (pathname === "/workbench/classic") return <>{children}</>;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Skip link: the first tab stop, so a keyboard user is not forced
          through the whole rail to reach the content. */}
      <a
        href="#workspace-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:border focus:border-[var(--accent)] focus:bg-[var(--surface)] focus:px-3 focus:py-2 focus:text-[11px]"
      >
        Skip to content
      </a>

      {/* ---- context bar ---------------------------------------------- */}
      <header className="hairline flex shrink-0 items-center justify-between gap-4 bg-[var(--surface)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <Logo />
          <span className="hidden h-4 w-px bg-[var(--border)] lg:block" />
          <div className="hidden min-w-0 lg:block">
            <Breadcrumbs actorLabel={profile?.label ?? null} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Current actor + confidence, read from the store. */}
          {actorId && (
            <span
              data-testid="context-actor"
              data-actor-id={actorId}
              data-confidence={confidence === null ? "" : confidence.toFixed(3)}
              className="mono hidden items-center gap-2 border border-[var(--border-2)] px-2 py-1 text-[9px] md:inline-flex"
            >
              <span className="max-w-[14ch] truncate text-[var(--text)]">
                {profile?.label ?? actorId}
              </span>
              <span className="tnum text-[var(--c-high)]">
                {confidence === null ? "not measured" : confidence.toFixed(3)}
              </span>
              <span className="text-[var(--muted-2)]">{BAND_LABEL[band]}</span>
            </span>
          )}

          <span className="hidden items-center gap-1.5 md:flex" title="Autonomous collection">
            <Activity className={`h-3 w-3 ${live ? "text-[var(--ok)]" : "text-[var(--muted-2)]"}`} />
            <span className="mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
              {live ? "autonomous · on" : "autonomous · off"}
            </span>
          </span>

          {metrics && (
            <span className="mono hidden text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)] xl:inline">
              false-merge{" "}
              <span className="tnum text-[var(--text)]">
                {(metrics.false_merge_rate * 100).toFixed(1)}%
              </span>{" "}
              @ α={metrics.alpha}
            </span>
          )}

          <button
            onClick={() => setPaletteOpen(true)}
            className="mono hidden items-center gap-1 border border-[var(--border-2)] px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-[var(--muted-2)] transition hover:text-[var(--text)] sm:inline-flex"
            aria-label="Open command palette"
            title="Command palette (Cmd/Ctrl-K)"
          >
            {/* lucide, not the U+2318 glyph -- INV-7 bans decorative characters. */}
            <Command className="h-3 w-3" />K
          </button>

          <a
            href="/sangam"
            className="mono hidden items-center gap-1 border border-[var(--border-2)] px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)] sm:inline-flex"
          >
            Sangam
          </a>
          <span className="mono hidden text-[10px] text-[var(--muted-2)] lg:inline">
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

      <div className="flex min-h-0 flex-1">
        {/* ---- navigator rail ------------------------------------------ */}
        <nav
          aria-label="Workspace"
          className="hairline-r flex w-[52px] shrink-0 flex-col items-center gap-1 bg-[var(--surface)] py-2 lg:w-[168px] lg:items-stretch lg:px-2"
        >
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.href : pathname?.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`mono flex items-center gap-2 rounded-[var(--radius)] px-2 py-2 text-[9.5px] uppercase tracking-[0.1em] transition ${
                  active
                    ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--c-high)]"
                    : "text-[var(--muted-2)] hover:text-[var(--muted)]"
                }`}
                title={n.label}
              >
                <n.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden lg:inline">{n.label}</span>
              </Link>
            );
          })}

          {actorId && (
            <>
              <span className="my-1 h-px w-full bg-[var(--border)]" />
              <p className="mono hidden px-2 pb-1 text-[8px] uppercase tracking-[0.16em] text-[var(--muted-2)] lg:block">
                Actor
              </p>
              {ACTOR_TABS.map((t) => {
                const href = `/workbench/actor/${actorId}${t.seg}`;
                const active = pathname === href;
                return (
                  <Link
                    key={t.seg || "dossier"}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`mono flex items-center gap-2 rounded-[var(--radius)] px-2 py-1.5 text-[9.5px] uppercase tracking-[0.1em] transition ${
                      active
                        ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--c-high)]"
                        : "text-[var(--muted-2)] hover:text-[var(--muted)]"
                    }`}
                    title={t.label}
                  >
                    <t.icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden lg:inline">{t.label}</span>
                  </Link>
                );
              })}
            </>
          )}

          <span className="flex-1" />
          <Link
            href="/workbench/classic"
            className="mono flex items-center gap-2 rounded-[var(--radius)] px-2 py-2 text-[9px] uppercase tracking-[0.1em] text-[var(--muted-2)] transition hover:text-[var(--muted)]"
            title="The original single-page cockpit"
          >
            <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden lg:inline">Classic</span>
          </Link>
        </nav>

        <main id="workspace-content" className="slim min-h-0 flex-1 overflow-y-auto p-3">
          {children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
