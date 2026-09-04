"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { api, type ActorRow } from "@/lib/api";
import { trapFocus } from "@/lib/a11y";
import { useWorkspace } from "@/lib/workspace";

/**
 * Command palette (Cmd/Ctrl-K).
 *
 * FINDING-07 is closed here. The v2 rebuild removed every dialog, so
 * `lib/a11y.ts`'s `trapFocus` -- the DEC-042 fix, which cost a Playwright run to
 * find -- had been guarding nothing and was referenced by no code. This is the
 * first dialog the workspace adds, and it wires the trap back in rather than
 * hand-rolling a fourth version of the same bug.
 *
 * That means the accessibility contract this dialog carries is the one Phase 9
 * paid for: focus moves in on open, Tab wraps at both ends, Escape closes, and
 * focus returns to whatever opened it.
 */

interface Props {
  open: boolean;
  onClose: () => void;
}

type Item = {
  id: string;
  label: string;
  hint: string;
  href: string;
  /** Selecting an actor also sets the workspace context. */
  actorId?: string;
};

const ROUTES: Item[] = [
  { id: "r:overview", label: "Overview", hint: "Triage dashboard", href: "/workbench/overview" },
  { id: "r:actors", label: "Actors", hint: "Full actor list", href: "/workbench/actors" },
  { id: "r:compare", label: "Compare", hint: "Two actors side by side", href: "/workbench/compare" },
  { id: "r:tor", label: "Tor timing lab", hint: "Experiments", href: "/workbench/tor" },
  { id: "r:case", label: "Case ledger", hint: "CASE-001", href: "/workbench/case/CASE-001" },
  { id: "r:classic", label: "Classic cockpit", hint: "The default single page", href: "/workbench" },
  { id: "r:sangam", label: "SANGAM", hint: "WHO x WHERE map", href: "/sangam" },
];

export default function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const selectActor = useWorkspace((s) => s.selectActor);
  const [q, setQ] = useState("");
  const [actors, setActors] = useState<ActorRow[]>([]);
  const [cursor, setCursor] = useState(0);
  const [searching, setSearching] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus trap + Escape + focus restoration, from lib/a11y.ts (DEC-042).
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const release = trapFocus(panelRef.current, onClose);
    // The search field is where typing should land, not the first button.
    inputRef.current?.focus();
    return release;
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setQ("");
      setCursor(0);
    }
  }, [open]);

  // Actor search, debounced. `/graph/search` is the engine-side path and must
  // answer under a second; the actor index is the fallback when Neo4j is down,
  // which is the common case on a free-tier deploy (INV-9).
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await api.actors(q, 0, 8);
      if (!alive) return;
      setActors("ok" in res && res.ok ? res.actors : []);
      setSearching(false);
    }, 160);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, open]);

  const items = useMemo<Item[]>(() => {
    const needle = q.trim().toLowerCase();
    const routes = needle
      ? ROUTES.filter((r) => `${r.label} ${r.hint}`.toLowerCase().includes(needle))
      : ROUTES;
    const actorItems: Item[] = actors.map((a) => ({
      id: `a:${a.actor_id}`,
      label: a.label,
      hint:
        a.attribution_confidence === null
          ? `${a.actor_id} · not measured`
          : `${a.actor_id} · ${a.attribution_confidence.toFixed(2)} · ${a.personas}p`,
      href: `/workbench/actor/${a.actor_id}`,
      actorId: a.actor_id,
    }));
    return [...actorItems, ...routes];
  }, [q, actors]);

  useEffect(() => setCursor(0), [q]);

  function choose(item: Item) {
    if (item.actorId) selectActor(item.actorId);
    onClose();
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter" && items[cursor]) {
      e.preventDefault();
      choose(items[cursor]);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-[color-mix(in_srgb,black_62%,transparent)] pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
        className="glass w-[min(560px,92vw)] overflow-hidden"
      >
        <div className="hairline flex items-center gap-2 px-3 py-2.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-[var(--muted-2)]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to an actor, a case, or a route"
            aria-label="Search actors and routes"
            className="mono w-full bg-transparent text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--muted-2)]"
          />
          <span className="mono shrink-0 text-[8.5px] uppercase tracking-[0.14em] text-[var(--muted-2)]">
            Esc
          </span>
        </div>

        <ul className="slim max-h-[46vh] overflow-y-auto p-1.5" role="listbox" aria-label="Results">
          {items.length === 0 && (
            <li className="mono px-2 py-4 text-center text-[10px] text-[var(--muted-2)]">
              {searching ? "Searching…" : "No matches."}
            </li>
          )}
          {items.map((item, i) => (
            <li key={item.id}>
              <button
                role="option"
                aria-selected={i === cursor}
                onMouseEnter={() => setCursor(i)}
                onClick={() => choose(item)}
                className={`mono flex w-full items-center justify-between gap-3 rounded-[var(--radius)] px-2 py-1.5 text-left text-[11px] transition ${
                  i === cursor
                    ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--c-high)]"
                    : "text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                <span className="truncate">{item.label}</span>
                <span className="shrink-0 text-[9px] text-[var(--muted-2)]">{item.hint}</span>
              </button>
            </li>
          ))}
        </ul>

        <p className="hairline-t mono flex items-center gap-2 border-t border-[var(--border)] px-3 py-1.5 text-[8.5px] uppercase tracking-[0.14em] text-[var(--muted-2)]">
          <CornerDownLeft className="h-3 w-3" /> open · arrows to move · Esc to close
        </p>
      </div>
    </div>
  );
}
