"use client";

import { useEffect, useState } from "react";

/**
 * A brief boot sequence that plays once when the site opens, then fades — so
 * arriving feels like powering up an instrument rather than loading a page.
 * Skips instantly under reduced motion.
 */
const LINES = [
  "initialising attribution engine",
  "loading public footprint indexes",
  "resolving cross-market personas",
  "calibrating confidence model",
  "PRAHARI online",
];

export default function Intro() {
  const [i, setI] = useState(0);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setGone(true);
      return;
    }
    if (sessionStorage.getItem("prahari-intro")) { setGone(true); return; }
    const step = setInterval(() => setI((n) => Math.min(n + 1, LINES.length)), 380);
    const done = setTimeout(() => {
      setGone(true);
      try { sessionStorage.setItem("prahari-intro", "1"); } catch {}
    }, 2400);
    return () => { clearInterval(step); clearTimeout(done); };
  }, []);

  if (gone) return null;

  return (
    <div className="intro fixed inset-0 z-[200] flex items-center justify-center bg-[var(--bg)]">
      <div className="w-full max-w-sm px-6">
        <p className="mono mb-4 text-[10px] uppercase tracking-[0.3em] text-[var(--c-high)]">
          प्रहरी · PRAHARI
        </p>
        <ul className="space-y-1.5">
          {LINES.slice(0, i).map((l, k) => (
            <li key={l} className="mono flex items-center gap-2 text-[11px] text-[var(--muted)]">
              <span className="text-[var(--ok)]">›</span>
              {l}
              {k === i - 1 && k < LINES.length - 1 && <Cursor />}
            </li>
          ))}
        </ul>
      </div>
      <style jsx>{`
        .intro { animation: fade 0.5s ease-out 1.9s forwards; }
        @keyframes fade { to { opacity: 0; visibility: hidden; } }
      `}</style>
    </div>
  );
}

function Cursor() {
  return (
    <span className="inline-block h-3 w-1.5 bg-[var(--c-high)]"
      style={{ animation: "blink 0.8s step-end infinite" }}>
      <style jsx>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
    </span>
  );
}
