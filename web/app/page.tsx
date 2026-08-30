import Link from "next/link";
import {
  Fingerprint, GitBranch, Layers, Lock, Server, Sigma, Timer,
} from "lucide-react";
import GlobeStage from "@/components/three/GlobeStage";
import NoiseField from "@/components/three/NoiseField";
import Intro from "@/components/home/Intro";
import Logo from "@/components/ui/Logo";

// Every number here is measured and reproducible with
// `python -m engine.fusion.eval`. A figure that cannot be traced to
// docs/METRICS.md does not belong on this page.
const METRICS = [
  { label: "Calibrated confidence", value: "0.84", note: "worked example; naive stacking says 0.999" },
  { label: "False-merge rate", value: "3.1%", note: "bounded at α = 0.05, guarantee holds" },
  { label: "Expected calibration error", value: "0.005", note: "0.84 actually means 84%" },
  { label: "Cost to run", value: "₹0", note: "no API key required for the full demo" },
];

const CAPABILITIES = [
  {
    icon: Server,
    title: "Infrastructure pivoting",
    body: "An onion whose certificate names a clearnet host, a favicon hash reused on a public server, an exposed vhost. Read from certificate-transparency logs and published scan data — never by touching the hidden service.",
    ps: "PS capability 1",
  },
  {
    icon: GitBranch,
    title: "Cross-market actor graph",
    body: "Handles, PGP keys, wallets and trust links become one graph. Only hard identifiers form an actor, so a shared inbox or a co-mention never merges two people by accident.",
    ps: "PS capability 2",
  },
  {
    icon: Fingerprint,
    title: "Stylometry and rebrand detection",
    body: "Character n-grams, function words, punctuation habits and Hinglish markers, plus posting rhythm. A persona going quiet as another appears with the same hand is the shape of a rebrand.",
    ps: "PS capability 3",
  },
];

const USPS = [
  {
    icon: Sigma,
    title: "Confidence that survives cross-examination",
    body: "Stack five correlated signals naively and you get 0.999 — false certainty. PRAHARI converts each to a likelihood ratio, collapses them by root cause so one fact cannot be counted five times, and dampens each by its measured reliability. The same evidence gives 0.84.",
  },
  {
    icon: Timer,
    title: "A published error rate",
    body: "Split-conformal prediction bounds the false-merge rate among accepted links at a chosen risk budget. At α = 0.05 we measure 3.1%. Distribution-free and finite-sample — not a hope.",
  },
  {
    icon: Lock,
    title: "A record nobody can quietly edit",
    body: "Every analyst action is canonically serialised, keccak-hashed, chained and signed with an Ed25519 key. The case Merkle root is anchored on chain — 32-byte hashes only, never PII. One record can be proved without disclosing the rest.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <nav className="hairline sticky top-0 z-20 bg-[color-mix(in_srgb,var(--bg)_85%,transparent)] backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-3">
          <Logo />
          <div className="flex items-center gap-5">
            <Link href="/about" className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted-2)] transition hover:text-[var(--text)]">
              How it works
            </Link>
            <Link href="/docs" className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted-2)] transition hover:text-[var(--text)]">
              Docs
            </Link>
            <Link href="/workbench" className="mono border border-[var(--border-2)] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)]">
              Workbench
            </Link>
          </div>
        </div>
      </nav>

      <Intro />

      {/* Cinematic hero: the globe fills the right of the fold, content the left. */}
      <section className="relative overflow-hidden">
        <NoiseField />
        <div className="absolute right-[-8%] top-1/2 hidden h-[120%] w-[62%] -translate-y-1/2 lg:block">
          <GlobeStage />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[var(--bg)] via-[var(--bg)]/70 to-transparent lg:via-transparent" />

        <div className="relative mx-auto max-w-[1200px] px-5 pb-20 pt-24 sm:pt-32">
          <p className="mono text-[10px] uppercase tracking-[0.24em] text-[var(--muted-2)]">
            Smart India Hackathon 2026 · PS 26151 · NTRO
          </p>
          <h1 className="display mt-5 max-w-3xl text-4xl font-bold leading-[1.04] tracking-tight text-[var(--text)] sm:text-6xl">
            Dark-web threat actors leave the same fingerprints{" "}
            <span className="text-[var(--c-high)]">in public places.</span>
          </h1>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
            A reused signing key. A wallet on two marketplaces. An onion whose TLS
            certificate names a clearnet host. A writing habit that survives a
            rebrand. PRAHARI collects those footprints, links the personas behind
            them into one actor, and reports how confident it is — with a published
            error rate and a record nobody can quietly edit.
          </p>
          <p className="mono mt-5 max-w-xl border-l-2 border-[var(--accent-dim)] pl-3 text-[11px] leading-relaxed text-[var(--muted)]">
            We never touch Tor. We correlate what operators leaked themselves — and
            prove it with a live timing attack on our own hidden service.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/login"
              className="mono group flex items-center gap-2 border border-[var(--accent-dim)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-5 py-2.5 text-[11px] uppercase tracking-[0.18em] text-[var(--c-high)] transition hover:bg-[color-mix(in_srgb,var(--accent)_24%,transparent)]">
              Enter the workbench
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
            <Link href="/about"
              className="mono border border-[var(--border-2)] px-5 py-2.5 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] transition hover:border-[var(--muted-2)] hover:text-[var(--text)]">
              How it works
            </Link>
          </div>

          <dl className="mt-16 grid max-w-2xl gap-px border border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
            {METRICS.map((m) => (
              <div key={m.label} className="bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] px-4 py-4 backdrop-blur">
                <dd className="mono tnum text-2xl font-bold text-[var(--c-high)]">{m.value}</dd>
                <dt className="mono mt-1 text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">{m.label}</dt>
                <p className="mono mt-1 text-[9px] leading-relaxed text-[var(--muted-2)]">{m.note}</p>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Mandated capabilities */}
      <section className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-[1200px] px-5 py-16">
          <h2 className="display text-2xl font-bold text-[var(--text)]">
            The three capabilities the problem statement mandates
          </h2>
          <div className="mt-8 grid gap-px border border-[var(--border)] bg-[var(--border)] md:grid-cols-3">
            {CAPABILITIES.map((c) => (
              <article key={c.title} className="bg-[var(--surface)] p-5">
                <c.icon className="h-4 w-4 text-[var(--c-high)]" strokeWidth={1.75} />
                <p className="mono mt-3 text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
                  {c.ps}
                </p>
                <h3 className="display mt-1 text-[15px] font-semibold text-[var(--text)]">
                  {c.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">{c.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* The argument */}
      <section className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-[1200px] px-5 py-16">
          <p className="mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted-2)]">
            Why this is different
          </p>
          <h2 className="display mt-3 max-w-3xl text-2xl font-bold leading-snug text-[var(--text)]">
            Any system can output a number. The question is what happens when
            it is wrong.
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {USPS.map((u) => (
              <article key={u.title}>
                <u.icon className="h-4 w-4 text-[var(--c-high)]" strokeWidth={1.75} />
                <h3 className="display mt-3 text-[15px] font-semibold text-[var(--text)]">
                  {u.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">{u.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* The pitch, as a figure */}
      <section className="border-t border-[var(--border)]">
        <div className="mx-auto max-w-[1200px] px-5 py-16">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h2 className="display text-2xl font-bold text-[var(--text)]">
                0.84, not 0.999
              </h2>
              <p className="mt-4 text-[14px] leading-relaxed text-[var(--muted)]">
                Five signals agree that two personas are the same actor: a PGP key,
                a shared wallet, common infrastructure, writing style and posting
                rhythm. Treat them as independent and the arithmetic says 0.999.
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-[var(--muted)]">
                But the wallet and the infrastructure often share one cause, and
                style is the weakest evidence we have. Collapse by root cause,
                dampen by reliability, and the honest answer is 0.84.
              </p>
              <p className="mono mt-4 border-l-2 border-[var(--accent-dim)] pl-3 text-[11px] leading-relaxed text-[var(--muted)]">
                0.84 is defensible in court. 0.999 gets the case thrown out.
              </p>
            </div>

            <div className="panel marked p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">PRAHARI</p>
                  <p className="mono tnum mt-1 text-4xl font-bold text-[var(--c-high)]">0.840</p>
                </div>
                <div>
                  <p className="mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">Naive stacking</p>
                  <p className="mono tnum mt-1 text-4xl font-bold text-[var(--muted-2)]">0.999</p>
                </div>
              </div>
              <table className="mono mt-5 w-full text-[10px]">
                <tbody>
                  {[
                    ["Identity key", "0.78", "0.9"],
                    ["Financial", "0.71", "0.7"],
                    ["Infrastructure", "0.83", "0.8"],
                    ["Linguistic", "0.69", "0.5"],
                    ["Temporal", "0.74", "0.5"],
                  ].map(([root, s, r]) => (
                    <tr key={root} className="border-t border-[var(--border)]">
                      <td className="py-1 text-[var(--muted)]">{root}</td>
                      <td className="tnum py-1 text-right text-[var(--text)]">s={s}</td>
                      <td className="tnum py-1 text-right text-[var(--muted-2)]">r={r}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mono mt-3 text-[9px] text-[var(--muted-2)]">
                Every figure reproducible with <span className="text-[var(--muted)]">python -m engine.fusion.eval</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Honesty */}
      <section className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-[1200px] px-5 py-16">
          <Layers className="h-4 w-4 text-[var(--muted-2)]" strokeWidth={1.75} />
          <h2 className="display mt-3 text-2xl font-bold text-[var(--text)]">
            What it does not do
          </h2>
          <ul className="mt-5 grid max-w-4xl gap-3 text-[13px] leading-relaxed text-[var(--muted)] md:grid-cols-2">
            {[
              "It does not break Tor, and never claims to. Every source is a public index that already holds the data.",
              "It does not scrape live marketplaces or probe target hosts. Passivity is enforced by a network-layer test, not a promise.",
              "Behavioural analysis runs on labelled synthetic ground truth, because the public marketplace archive we ingest carries no timestamps.",
              "Stylometry is the weakest signal in the system and is weighted at half a signing key's reliability, deliberately.",
            ].map((t) => (
              <li key={t} className="border-l-2 border-[var(--border-2)] pl-3">{t}</li>
            ))}
          </ul>
          <p className="mono mt-6 max-w-2xl text-[11px] leading-relaxed text-[var(--muted-2)]">
            A system that publishes its limits is one you can check. That is the
            point of the whole design.
          </p>
        </div>
      </section>

      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-6">
          <p className="mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
            PRAHARI · प्रहरी · SIH 2026 PS 26151 · Team Vasiliades
          </p>
          <p className="mono text-[9px] text-[var(--muted-2)]">
            Free and open source · runs entirely on-premise
          </p>
        </div>
      </footer>
    </div>
  );
}
