import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function Hero({ metrics }: { metrics: { label: string; value: string; note: string }[] }) {
  return (
    <section className="mx-auto max-w-[1200px] px-5 pb-16 pt-20 sm:pt-28">
      <p className="mono text-[10px] uppercase tracking-[0.24em] text-[var(--muted-2)]">
        Smart India Hackathon 2026 · PS 26151 · NTRO
      </p>

      <h1 className="display mt-5 max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight text-[var(--text)] sm:text-6xl">
        Dark-web threat actors leave the same fingerprints{" "}
        <span className="text-[var(--c-high)]">in public places.</span>
      </h1>

      <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
        A reused signing key. A wallet that appears on two marketplaces. An onion
        whose TLS certificate names a clearnet host. A writing habit that survives
        a rebrand. PRAHARI collects those footprints from public indexes, links the
        personas behind them into one actor, and reports how confident it is — with
        a published error rate and a record nobody can quietly edit.
      </p>

      <p className="mono mt-5 max-w-2xl border-l-2 border-[var(--accent-dim)] pl-3 text-[11px] leading-relaxed text-[var(--muted)]">
        We never touch Tor. Attribution here means correlating what operators
        leaked themselves — and we say so, because a system that claims to break
        Tor is claiming something nobody can deliver.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href="/workbench"
          className="mono flex items-center gap-2 border border-[var(--accent-dim)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-5 py-2.5 text-[11px] uppercase tracking-[0.18em] text-[var(--c-high)] transition hover:bg-[color-mix(in_srgb,var(--accent)_22%,transparent)]">
          Open the workbench <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link href="/about"
          className="mono border border-[var(--border-2)] px-5 py-2.5 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] transition hover:border-[var(--muted-2)] hover:text-[var(--text)]">
          How it works
        </Link>
      </div>

      <dl className="mt-14 grid gap-px border border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="bg-[var(--surface)] px-4 py-4">
            <dd className="mono tnum text-2xl font-bold text-[var(--c-high)]">{m.value}</dd>
            <dt className="mono mt-1 text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">
              {m.label}
            </dt>
            <p className="mono mt-1 text-[9px] leading-relaxed text-[var(--muted-2)]">{m.note}</p>
          </div>
        ))}
      </dl>
    </section>
  );
}
