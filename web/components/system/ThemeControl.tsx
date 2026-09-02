"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Shuffle, Sparkles, Unlock } from "lucide-react";
import {
  SKINS,
  LAYOUTS,
  FONT_PAIRS,
  STORAGE_KEYS,
  applyDraw,
  persistSession,
  type FontPair,
  type LayoutId,
} from "@/lib/skins";

/**
 * The reskin control.
 *
 * DEC-055 made the draw a property of the VISIT, so this control's three
 * actions now have to be distinct and stated on screen -- previously "lock" and
 * "reshuffle" both wrote the same key and the difference was invisible:
 *
 *   Reshuffle  new draw, written to sessionStorage, applied live, and HELD for
 *              the rest of the visit.
 *   Lock       written to localStorage. Survives new visits and wins over the
 *              session draw.
 *   Unlock     clears the lock and KEEPS the current draw. It does not re-roll
 *              under the user -- unlocking is not a request for a new look.
 *
 * The caption underneath says which of those is in force right now, because a
 * user who cannot tell "locked on Abyss" from "happens to have drawn Abyss"
 * cannot use the control deliberately.
 */
export default function ThemeControl() {
  const [skin, setSkin] = useState<string>("ember");
  const [locked, setLocked] = useState(false);
  const [source, setSource] = useState<string>("session");
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState(false);

  // Read what the pre-paint script already resolved, rather than resolving
  // again -- a second resolution here could disagree with what was painted.
  useEffect(() => {
    const d = document.documentElement;
    setSkin(d.getAttribute("data-skin") ?? "ember");
    setSource(d.getAttribute("data-skin-source") ?? "session");
    try {
      setLocked(
        Boolean(
          localStorage.getItem(STORAGE_KEYS.lock) ??
            localStorage.getItem(STORAGE_KEYS.legacyLock)
        )
      );
    } catch {
      // Storage unavailable (private mode, embedded webview). The control still
      // works for this visit; it just cannot offer a durable lock.
    }
  }, []);

  const currentDraw = useCallback(() => {
    const d = document.documentElement;
    return {
      skin: d.getAttribute("data-skin") ?? "ember",
      layout: ((d.getAttribute("data-layout") as LayoutId) ?? "a") satisfies LayoutId,
      fontPair: (Number(d.getAttribute("data-font") ?? 0) || 0) as FontPair,
    };
  }, []);

  /** Apply a draw, hold it for the visit, and keep the lock in step. */
  const commit = useCallback(
    (next: { skin: string; layout: LayoutId; fontPair: FontPair }, nextSource: string) => {
      const d = document.documentElement;
      applyDraw(next, d);
      d.setAttribute("data-skin-source", nextSource);
      setSkin(next.skin);
      setSource(nextSource);

      // The draw is held for the rest of the visit, storage permitting; on a
      // throw persistSession keeps it in the module singleton instead.
      try {
        persistSession(next, window.sessionStorage);
      } catch {
        persistSession(next, null);
      }

      // A locked skin follows an explicit pick, so choosing a swatch while
      // locked updates the lock rather than silently diverging from it.
      if (locked) {
        try {
          localStorage.setItem(STORAGE_KEYS.lock, next.skin);
        } catch {
          /* durable lock unavailable; the session draw still holds */
        }
      }

      setFlash(true);
      setTimeout(() => setFlash(false), 420);
    },
    [locked]
  );

  function pickSkin(id: string) {
    commit({ ...currentDraw(), skin: id }, locked ? "lock" : "session");
  }

  /** A new draw across all three dimensions, held for the rest of the visit. */
  function reshuffle() {
    const others = SKINS.filter((s) => s.id !== skin);
    const next = others[Math.floor(Math.random() * others.length)];
    commit(
      {
        skin: next.id,
        layout: LAYOUTS[Math.floor(Math.random() * LAYOUTS.length)],
        fontPair: FONT_PAIRS[Math.floor(Math.random() * FONT_PAIRS.length)] as FontPair,
      },
      locked ? "lock" : "session"
    );
  }

  function toggleLock() {
    const cur = currentDraw();
    try {
      if (locked) {
        // Unlock KEEPS the current draw. Re-rolling here would punish the user
        // for asking a question about persistence.
        localStorage.removeItem(STORAGE_KEYS.lock);
        localStorage.removeItem(STORAGE_KEYS.legacyLock);
        setLocked(false);
        setSource("session");
        document.documentElement.setAttribute("data-skin-source", "session");
        try {
          persistSession(cur, window.sessionStorage);
        } catch {
          persistSession(cur, null);
        }
      } else {
        localStorage.setItem(STORAGE_KEYS.lock, cur.skin);
        setLocked(true);
        setSource("lock");
        document.documentElement.setAttribute("data-skin-source", "lock");
      }
    } catch {
      /* storage refused; leave the visible state as it was */
    }
  }

  const current = SKINS.find((s) => s.id === skin);

  /** One line stating exactly which tier is in force. */
  const caption = locked
    ? `Locked · ${current?.name ?? skin}`
    : source === "query"
      ? `URL skin · ${current?.name ?? skin}`
      : `Session skin · ${current?.name ?? skin}`;

  return (
    <>
      {flash && (
        <div
          className="pointer-events-none fixed inset-0 z-[60] bg-[var(--halo)] opacity-40"
          style={{ animation: "rise 0.4s ease" }}
        />
      )}
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
                  onClick={() => pickSkin(s.id)}
                  title={`${s.name} — ${s.mood}`}
                  className={`group flex flex-col items-center gap-1 rounded-[var(--radius)] border p-1.5 transition ${
                    s.id === skin
                      ? "border-[var(--accent)]"
                      : "border-[var(--border)] hover:border-[var(--border-2)]"
                  }`}
                >
                  <span
                    className="h-4 w-full rounded-[3px]"
                    style={{ background: `linear-gradient(120deg, ${s.accent}, ${s.accent}22)` }}
                  />
                  <span className="mono text-[8px] text-[var(--muted)]">{s.name}</span>
                </button>
              ))}
            </div>

            <button
              onClick={toggleLock}
              className="mono mt-2 flex w-full items-center justify-center gap-1.5 border border-[var(--border-2)] py-1.5 text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] transition hover:text-[var(--text)]"
            >
              {locked ? (
                <Lock className="h-3 w-3 text-[var(--c-high)]" />
              ) : (
                <Unlock className="h-3 w-3" />
              )}
              {locked ? "Unlock · keeps this skin" : "Lock · survives new visits"}
            </button>

            <p
              data-testid="skin-state"
              className="mono mt-1.5 text-center text-[8.5px] leading-relaxed text-[var(--muted-2)]"
            >
              {caption}
              <br />
              {locked
                ? "Held across visits until you unlock."
                : "Held for this visit; a new visit draws again."}
            </p>
          </div>
        )}

        <div className="glass flex items-center gap-1 p-1">
          <button
            onClick={() => setOpen((v) => !v)}
            className="mono flex items-center gap-1.5 px-2 py-1.5 text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] transition hover:text-[var(--text)]"
            aria-expanded={open}
            title={caption}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: current?.accent, boxShadow: `0 0 8px ${current?.accent}` }}
            />
            {current?.name ?? "Skin"}
          </button>
          <button
            onClick={reshuffle}
            title="Reshuffle — a new draw, held for the rest of this visit"
            aria-label="Reshuffle the look"
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius)] text-[var(--muted)] transition hover:bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] hover:text-[var(--c-high)]"
          >
            <Shuffle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}
