"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

/**
 * Breadcrumbs for the nested workspace routes (DEC-056).
 *
 * The workspace is up to four levels deep (`/workbench/actor/{id}/evidence`), so
 * "where am I" stops being obvious. Built from the pathname rather than from
 * component state, so a pasted deep link renders the same trail as a click-path
 * to the same place.
 */

const LABELS: Record<string, string> = {
  workbench: "Workspace",
  actors: "Actors",
  actor: "Actor",
  compare: "Compare",
  tor: "Tor timing",
  case: "Case",
  classic: "Classic",
  graph: "Graph",
  evidence: "Evidence",
  timeline: "Timeline",
  chain: "Chain",
};

export default function Breadcrumbs({ actorLabel }: { actorLabel: string | null }) {
  const pathname = usePathname() ?? "";
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length === 0) return null;

  const crumbs: { label: string; href: string }[] = [];
  let href = "";
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    href += `/${seg}`;

    // The "actor" segment is structural; the id after it is the interesting
    // one, so they collapse into a single crumb carrying the actor's label.
    if (seg === "actor") continue;
    if (segs[i - 1] === "actor") {
      crumbs.push({ label: actorLabel ?? seg, href });
      continue;
    }
    if (segs[i - 1] === "case") {
      crumbs.push({ label: seg, href });
      continue;
    }
    crumbs.push({ label: LABELS[seg] ?? seg, href });
  }

  return (
    <nav aria-label="Breadcrumb">
      <ol className="mono flex items-center gap-1 text-[9px] uppercase tracking-[0.14em]">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.href} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-[var(--muted-2)]" />}
              {last ? (
                <span aria-current="page" className="max-w-[18ch] truncate text-[var(--text)]">
                  {c.label}
                </span>
              ) : (
                <Link
                  href={c.href}
                  className="max-w-[14ch] truncate text-[var(--muted-2)] transition hover:text-[var(--muted)]"
                >
                  {c.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
