"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BookOpen, ExternalLink, Github, Info, Map, ShieldCheck } from "lucide-react";
import { buildLine } from "@/lib/buildInfo";
import {
  INITIAL, V1_URL, probe, probeEngine, type ServiceStatus,
} from "@/lib/serviceStatus";

/**
 * THE FOOTER (DEC-063).
 *
 * Two jobs. The first is to link PRAHARI v1 — the Jabalpur geofence console —
 * so the two versions of this project are reachable from each other. The second
 * is to say, on every page, what this system does and does not claim.
 *
 * The status dot is the reason the link is worth having. v1 is a free Render
 * service and is asleep most of the time; a link with no warning sends a judge
 * to a page that takes thirty seconds to appear and looks broken. The dot says
 * "waking — may take 30–60 s" instead, and when the CHECK itself fails it says
 * "unknown" rather than "offline" — a failed check is a fact about our
 * knowledge, not about the service.
 *
 * lucide icons only, skin tokens only (INV-7, DEC-055).
 */

const NEVER = [
  "We never touch Tor.",
  "We never scrape a live market.",
  "We never put PII on chain.",
  "We never claim certainty.",
] as const;

const HONESTY =
  "PRAHARI correlates footprints operators published themselves. It does not break Tor, " +
  "scrape live marketplaces, probe target hosts, or claim certainty.";

function Dot({ status }: { status: ServiceStatus }) {
  const colour =
    status.state === "live"
      ? "var(--ok)"
      : status.state === "waking"
        ? "var(--warn)"
        : "var(--muted-2)";
  return (
    <span
      className="inline-flex items-center gap-1"
      data-testid="status-dot"
      data-state={status.state}
      title={status.label}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: colour, boxShadow: `0 0 6px ${colour}` }}
      />
      {/* The label is text, not colour alone: a colour-blind reader and a
          screen reader both get the same fact. */}
      <span className="mono text-[8.5px] text-[var(--muted-2)]">{status.label}</span>
    </span>
  );
}

/**
 * Routes that own the full viewport and mount their own slim footer.
 *
 * The root footer suppresses itself here rather than the shells suppressing the
 * root one, because the decision lives with the component that knows why: a
 * six-column footer under a 3D graph takes vertical space from the evidence to
 * display a copyright notice. The classic cockpit is included -- it is
 * `h-screen` and the Phase 0 visual baseline is a picture of it.
 */
const FULL_VIEWPORT = ["/workbench", "/sangam", "/command"];

export default function Footer({ slim = false }: { slim?: boolean }) {
  const pathname = usePathname() ?? "";
  const [v1, setV1] = useState<ServiceStatus>(INITIAL);
  const [engine, setEngine] = useState<ServiceStatus>(INITIAL);

  useEffect(() => {
    let alive = true;
    void (async () => {
      // no-cors: we cannot read v1's response and do not need to. Whether the
      // request completed is the whole signal.
      const a = await probe(V1_URL, { mode: "no-cors" });
      if (alive) setV1(a);
      const b = await probeEngine();
      if (alive) setEngine(b);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const v1Link = (
    <a
      href={V1_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="mono inline-flex items-center gap-1 text-[var(--c-high)] underline decoration-dotted underline-offset-2 transition hover:text-[var(--text)]"
    >
      <Map className="h-3 w-3" />
      PRAHARI v1
      {/* Announced as external, so a screen reader does not open a new tab
          without warning. */}
      <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );

  // The root instance stands down where a shell renders its own.
  if (!slim && FULL_VIEWPORT.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  if (slim) {
    /**
     * The workspace variant.
     *
     * One line. The cockpit's vertical space is the scarcest thing on the
     * screen, and a six-column footer under a graph would be taking room from
     * the evidence to display a copyright notice.
     */
    return (
      <footer
        role="contentinfo"
        data-testid="footer"
        data-variant="slim"
        className="hairline-t mono flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-[8.5px] text-[var(--muted-2)]"
      >
        {v1Link}
        <Dot status={v1} />
        <span className="h-3 w-px bg-[var(--border)]" />
        <span className="inline-flex items-center gap-1">
          <Activity className="h-2.5 w-2.5" /> Engine
        </span>
        <Dot status={engine} />
        <span className="ml-auto">{buildLine()}</span>
        <span>SIH 2026 · PS 26151 · NTRO · Team Vasiliades</span>
      </footer>
    );
  }

  return (
    <footer
      role="contentinfo"
      data-testid="footer"
      data-variant="full"
      className="mt-12 border-t border-[var(--border)] bg-[var(--surface)] px-6 py-8"
    >
      <div className="mx-auto grid max-w-[1180px] gap-6 md:grid-cols-4">
        {/* ---- v1 ---- */}
        <section>
          <h2 className="mono mb-2 text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
            The other half
          </h2>
          {v1Link}
          <p className="mono mt-1 text-[9px] leading-relaxed text-[var(--muted)]">
            v1 — the Jabalpur geofence console.
          </p>
          <div className="mt-1.5">
            <Dot status={v1} />
          </div>
          {v1.state === "waking" && (
            <p className="mono mt-1 text-[8.5px] leading-relaxed text-[var(--muted-2)]">
              It is a free instance and sleeps when idle. The first request wakes it.
            </p>
          )}
        </section>

        {/* ---- links ---- */}
        <section>
          <h2 className="mono mb-2 text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
            This build
          </h2>
          <ul className="space-y-1">
            {[
              { href: "/about", label: "About", icon: Info },
              { href: "/docs", label: "Docs", icon: BookOpen },
              { href: "/docs#api", label: "API reference", icon: BookOpen },
            ].map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="mono inline-flex items-center gap-1 text-[9.5px] text-[var(--muted)] transition hover:text-[var(--text)]"
                >
                  <l.icon className="h-3 w-3" />
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href="https://github.com/utkarshwrks/Prahari"
                target="_blank"
                rel="noopener noreferrer"
                className="mono inline-flex items-center gap-1 text-[9.5px] text-[var(--muted)] transition hover:text-[var(--text)]"
              >
                <Github className="h-3 w-3" />
                GitHub
                <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          </ul>
          <p className="mono mt-2 inline-flex items-center gap-1 text-[8.5px] text-[var(--muted-2)]">
            <Activity className="h-2.5 w-2.5" /> Engine
          </p>
          <div className="mt-0.5">
            <Dot status={engine} />
          </div>
        </section>

        {/* ---- the four statements ---- */}
        <section className="md:col-span-2">
          <h2 className="mono mb-2 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
            <ShieldCheck className="h-3 w-3" /> What this system does not do
          </h2>
          <ul className="mono grid gap-1 text-[9.5px] text-[var(--muted)] sm:grid-cols-2">
            {NEVER.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <p className="mono mt-2 border-l-2 border-[var(--accent-dim)] pl-2 text-[9px] leading-relaxed text-[var(--muted)]">
            {HONESTY}
          </p>
        </section>
      </div>

      <div className="mx-auto mt-6 flex max-w-[1180px] flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
        <p className="mono text-[8.5px] text-[var(--muted-2)]">
          SIH 2026 · PS 26151 · NTRO · Team Vasiliades
        </p>
        <p className="mono text-[8.5px] text-[var(--muted-2)]" data-testid="build-line">
          {buildLine()}
        </p>
      </div>
    </footer>
  );
}
