"use client";

import { useEffect, useState } from "react";

const SECTIONS = [
  { id: "run", label: "Run it" },
  { id: "architecture", label: "Architecture" },
  { id: "confidence", label: "Confidence model" },
  { id: "custody", label: "Chain of custody" },
  { id: "api", label: "API reference" },
  { id: "metrics", label: "Measured results" },
  { id: "limits", label: "Limits" },
];

export default function Sidebar() {
  const [active, setActive] = useState("run");

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px" }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return (
    <nav aria-label="Documentation sections" className="sticky top-20 hidden lg:block">
      <ul className="space-y-1 border-l border-[var(--border)]">
        {SECTIONS.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={active === s.id ? "true" : undefined}
              className={`mono block border-l-2 py-1 pl-3 text-[10px] uppercase tracking-[0.14em] transition ${
                active === s.id
                  ? "border-[var(--accent)] text-[var(--c-high)]"
                  : "border-transparent text-[var(--muted-2)] hover:text-[var(--muted)]"
              }`}
              style={{ marginLeft: "-1px" }}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
