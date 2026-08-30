"use client";

import { useEffect, useState } from "react";
import { Lock, Shuffle, Sparkles, Unlock } from "lucide-react";
import { SKINS, LAYOUTS } from "@/lib/skins";

/**
 * The reshuffle control. PRAHARI regenerates its look on every load; this lets
 * the analyst force a new draw on demand, or lock the current skin so it stops
 * changing. Skins are pure token swaps, so nothing about the data or layout
 * logic is touched — only the atmosphere.
 */
export default function ThemeControl() {
  const [skin, setSkin] = useState<string>("ember");
  const [locked, setLocked] = useState(false);
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const d = document.documentElement;
    setSkin(d.getAttribute("data-skin") ?? "ember");
    try { setLocked(!!localStorage.getItem("prahari-skin-lock")); } catch { /* ignore */ }
  }, []);

  function apply(id: string, layout?: string) {
    const d = document.documentElement;
    d.setAttribute("data-skin", id);
    if (layout) d.setAttribute("data-layout", layout);
    setSkin(id);
    setFlash(true);
    setTimeout(() => setFlash(false), 420);
    if (locked) { try { localStorage.setItem("prahari-skin-lock", id); } catch { /* ignore */ } }
  }

  function reshuffle() {
    const others = SKINS.filter((s) => s.id !== skin);
    const next = others[Math.floor(Math.random() * others.length)];
    const layout = LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)];
    apply(next.id, layout);
  }

  function toggleLock() {
    const d = document.documentElement;
    const cur = d.getAttribute("data-skin") ?? "ember";
    try {
      if (locked) { localStorage.removeItem("prahari-skin-lock"); setLocked(false); }
      else { localStorage.setItem("prahari-skin-lock", cur); setLocked(true); }
    } catch { /* ignore */ }
  }

  const current = SKINS.find((s) => s.id === skin);

  return (
    <>
      {flash && <div className="pointer-events-none fixed inset-0 z-[60] animate-[rise_0.4s_ease] bg-[var(--halo)] opacity-40" style={{ animation: "rise 0.4s ease" }} />}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        {open && (
          <div className="glass w-[210px] p-2.5 rise">
            <p className="mono mb-2 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
              <Sparkles className="h-3 w-3" /> Reskin engine
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {SKINS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => apply(s.id)}
                  title={`${s.name} — ${s.mood}`}
                  className={`group flex flex-col items-center gap-1 rounded-[var(--radius)] border p-1.5 transition ${
                    s.id === skin ? "border-[var(--accent)]" : "border-[var(--border)] hover:border-[var(--border-2)]"
                  }`}
                >
                  <span className="h-4 w-full rounded-[3px]" style={{ background: `linear-gradient(120deg, ${s.accent}, ${s.accent}22)` }} />
                  <span className="mono text-[8px] text-[var(--muted)]">{s.name}</span>
                </button>
              ))}
            </div>
            <button onClick={toggleLock} className="mono mt-2 flex w-full items-center justify-center gap-1.5 border border-[var(--border-2)] py-1.5 text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] transition hover:text-[var(--text)]">
              {locked ? <Lock className="h-3 w-3 text-[var(--c-high)]" /> : <Unlock className="h-3 w-3" />}
              {locked ? "Locked · stays on reload" : "Reshuffles each load"}
            </button>
          </div>
        )}
        <div className="glass flex items-center gap-1 p-1">
          <button
            onClick={() => setOpen((v) => !v)}
            className="mono flex items-center gap-1.5 px-2 py-1.5 text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] transition hover:text-[var(--text)]"
            title="Current skin"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: current?.accent, boxShadow: `0 0 8px ${current?.accent}` }} />
            {current?.name ?? "Skin"}
          </button>
          <button
            onClick={reshuffle}
            title="Reshuffle the look"
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius)] text-[var(--muted)] transition hover:bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] hover:text-[var(--c-high)]"
          >
            <Shuffle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}
