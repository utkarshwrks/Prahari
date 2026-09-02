import Link from "next/link";
import { FEATURES } from "@/lib/features";
import CommandPanel from "@/components/command/CommandPanel";

export const metadata = { title: "Command panel — PRAHARI" };

/**
 * `/command`, behind NEXT_PUBLIC_FF_COMMAND.
 *
 * With the flag off this renders a plain statement rather than a 404: a route
 * that exists but is switched off should say so, so an operator following the
 * deployment guide knows the difference between "not enabled here" and
 * "you typed it wrong".
 */
export default function Page() {
  if (!FEATURES.commandPanel) {
    return (
      <main className="mx-auto max-w-[60ch] p-8">
        <h1 className="mono text-[12px] uppercase tracking-[0.18em] text-[var(--text)]">
          Command panel is not enabled
        </h1>
        <p className="mono mt-2 text-[10px] leading-relaxed text-[var(--muted)]">
          This deployment has NEXT_PUBLIC_FF_COMMAND unset. The management surface, its
          authentication and its audit wiring are present but switched off. See docs/DEPLOYMENT.md
          for what to set before turning it on — it needs NEXTAUTH_SECRET, PASSWORD_PEPPER and
          ENGINE_SERVICE_SECRET, and the last of those must match on both services.
        </p>
        <Link
          href="/workbench"
          className="mono mt-4 inline-block border border-[var(--border-2)] px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)]"
        >
          Back to the workspace
        </Link>
      </main>
    );
  }
  return (
    <main className="slim mx-auto max-h-screen max-w-[1280px] overflow-y-auto p-3">
      <CommandPanel />
    </main>
  );
}
