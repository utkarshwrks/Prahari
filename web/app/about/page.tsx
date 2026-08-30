import Link from "next/link";
import Logo from "@/components/ui/Logo";

export const metadata = { title: "How it works — PRAHARI" };

const STAGES = [
  { n: "0", t: "Collect", b: "Public marketplace archives, certificate-transparency logs, published scan data, blockchain explorers, open-source intelligence feeds. Every source is an index that already holds the data — we read it, we never probe a target." },
  { n: "1", t: "Extract", b: "PGP fingerprints computed from real key blocks, onion v3 addresses, BTC/ETH/XMR wallets, emails, handles. Entity names are normalised before anything downstream sees them, so an abbreviation the model recognises is not silently dropped." },
  { n: "2", t: "Four engines", b: "Infrastructure pivoting, identity-graph resolution, stylometry and behaviour, blockchain lineage. Each emits signals labelled with the ROOT CAUSE of the agreement, which is what makes the next stage possible." },
  { n: "3", t: "Fuse", b: "Likelihood ratios per signal, collapsed to the strongest per root cause, dampened by measured reliability, capped by must-not-link rules. Isotonic calibration, then a conformal threshold with a bounded false-merge rate." },
  { n: "4", t: "Attribute", b: "Personas resolve into actors. The profile carries identifiers, infrastructure indicators, persona linkages, attribution confidence, category, last scan date and source — the fields the problem statement names." },
  { n: "5", t: "Seal", b: "Every analyst action is hashed into an append-only chain, signed with an Ed25519 key, and the case Merkle root is anchored on chain. A single record can be proved without disclosing the case around it." },
];

const NOT = [
  ["We never touch Tor.", "No code path can resolve a .onion hostname. A network-layer test asserts it during a full infrastructure pivot, and the guard function is checked by CI."],
  ["We never scrape a live market.", "The marketplace data is a publicly released academic archive. Reading a published index is not the same as crawling a target, and the distinction is the project's legal basis."],
  ["We never put PII on chain.", "Only 32-byte hashes. Even the case reference is hashed, because a public ledger is permanent and world-readable and a case number is still investigative metadata."],
  ["We never claim certainty.", "The system reports a calibrated probability with a published false-merge rate. A tool that says 99% is claiming something it cannot support."],
];

export default function About() {
  return (
    <div className="min-h-screen">
      <nav className="hairline sticky top-0 z-20 bg-[color-mix(in_srgb,var(--bg)_85%,transparent)] backdrop-blur">
        <div className="mx-auto flex max-w-[1000px] items-center justify-between px-5 py-3">
          <Link href="/"><Logo /></Link>
          <Link href="/workbench" className="mono border border-[var(--border-2)] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)]">
            Workbench
          </Link>
        </div>
      </nav>

      <article className="mx-auto max-w-[1000px] px-5 py-16">
        <p className="mono text-[10px] uppercase tracking-[0.24em] text-[var(--muted-2)]">
          PS 26151 · dark web threat actor de-anonymisation
        </p>
        <h1 className="display mt-4 text-4xl font-bold leading-tight text-[var(--text)]">
          How PRAHARI attributes an actor
        </h1>
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-[var(--muted)]">
          The problem statement asks for a system that links dark-web threat actors
          to real-world entities by gathering footprints and correlating identifying
          information. That is a correlation problem, not a network-attack problem —
          and treating it honestly as correlation is what makes the output usable as
          evidence.
        </p>

        <h2 className="display mt-14 text-xl font-bold text-[var(--text)]">The pipeline</h2>
        <ol className="mt-5 space-y-px border border-[var(--border)] bg-[var(--border)]">
          {STAGES.map((s) => (
            <li key={s.n} className="flex gap-4 bg-[var(--surface)] p-4">
              <span className="mono shrink-0 text-[11px] font-bold text-[var(--c-high)]">{s.n}</span>
              <div>
                <h3 className="display text-[15px] font-semibold text-[var(--text)]">{s.t}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">{s.b}</p>
              </div>
            </li>
          ))}
        </ol>

        <h2 className="display mt-14 text-xl font-bold text-[var(--text)]">
          The confidence model
        </h2>
        <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-[var(--muted)]">
          Each signal becomes a likelihood ratio, <span className="mono text-[var(--text)]">LR = s / (1 − s)</span>.
          Signals are grouped by <em>why</em> they agree and only the strongest survives per
          group, so two views of one certificate count once. Each group is then raised to a
          reliability exponent, because a signing key is not a writing style.
        </p>
        <p className="mono mt-4 border border-[var(--border)] bg-[var(--surface-2)] p-3 text-[11px] leading-relaxed text-[var(--muted)]">
          odds = prior_odds × Π (LR_root ^ r_root)   ·   p = odds / (1 + odds)
        </p>
        <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-[var(--muted)]">
          On the worked example this yields <span className="text-[var(--c-high)]">0.84</span> where
          naive stacking yields <span className="text-[var(--muted-2)]">0.999</span>. Isotonic
          regression then calibrates the score, and split-conformal prediction produces a
          threshold at which the false-merge rate is bounded — measured at{" "}
          <span className="text-[var(--c-high)]">3.1%</span> for a 5% risk budget.
        </p>

        <h2 className="display mt-14 text-xl font-bold text-[var(--text)]">
          What we refuse to do
        </h2>
        <dl className="mt-5 space-y-4">
          {NOT.map(([t, b]) => (
            <div key={t} className="border-l-2 border-[var(--accent-dim)] pl-4">
              <dt className="display text-[14px] font-semibold text-[var(--text)]">{t}</dt>
              <dd className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">{b}</dd>
            </div>
          ))}
        </dl>

        <h2 className="display mt-14 text-xl font-bold text-[var(--text)]">
          Free, open source, on-premise
        </h2>
        <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-[var(--muted)]">
          A unit handling investigative data cannot send it to a third-party service,
          and cannot depend on a vendor renewal. Everything runs on one machine:
          PostgreSQL, Neo4j Community, scikit-learn, a local chain when the network is
          down. Certificate transparency and host fingerprints both work without an
          account. <span className="text-[var(--text)]">Zero API keys are required</span> to
          run the full system.
        </p>

        <footer className="mono mt-16 border-t border-[var(--border)] pt-6 text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
          PRAHARI · प्रहरी · Team Vasiliades
        </footer>
      </article>
    </div>
  );
}
