"use client";

import { useEffect, useState } from "react";

export interface DocSection {
  id: string;
  label: string;
}

/** Sticky docs nav with scroll-spy: highlights the section currently in view. */
export default function DocsSidebar({ sections }: { sections: DocSection[] }) {
  const [active, setActive] = useState(sections[0]?.id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  return (
    <nav className="space-y-1">
      <div className="label mb-3 text-red-bright">Contents</div>
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={`mono block border-l-2 py-2 pl-3 text-[11px] uppercase tracking-[0.12em] transition ${
            active === s.id
              ? "border-red text-red-bright"
              : "border-border text-muted hover:border-border-2 hover:text-text"
          }`}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}
