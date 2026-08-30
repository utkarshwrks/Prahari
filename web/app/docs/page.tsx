import Link from "next/link";
import Logo from "@/components/ui/Logo";
import Sidebar from "@/components/docs/Sidebar";
import Code from "@/components/docs/Code";

export const metadata = { title: "Docs — PRAHARI" };

function H({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="display scroll-mt-20 border-t border-[var(--border)] pt-8 text-xl font-bold text-[var(--text)]">
      {children}
    </h2>
  );
}

export default function Docs() {
  return (
    <div className="min-h-screen">
      <nav className="hairline sticky top-0 z-20 bg-[color-mix(in_srgb,var(--bg)_85%,transparent)] backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-5 py-3">
          <Link href="/"><Logo /></Link>
          <div className="flex items-center gap-5">
            <Link href="/about" className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted-2)] transition hover:text-[var(--text)]">How it works</Link>
            <Link href="/workbench" className="mono border border-[var(--border-2)] px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)]">Workbench</Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto grid max-w-[1100px] gap-10 px-5 py-14 lg:grid-cols-[180px_1fr]">
        <Sidebar />

        <article className="min-w-0 max-w-2xl space-y-4 text-[13px] leading-relaxed text-[var(--muted)]">
          <p className="mono text-[10px] uppercase tracking-[0.24em] text-[var(--muted-2)]">Reference</p>
          <h1 className="display text-3xl font-bold text-[var(--text)]">Documentation</h1>

          <H id="run">Run it</H>
          <p>One command brings up the datastores, a local chain, the engine and the web app, then waits until each one actually answers.</p>
          <Code>{`npm run demo
# open  http://localhost:3000
# login analyst@prahari.local / prahari123`}</Code>
          <p>Every metric is reproducible:</p>
          <Code>{`python -m engine.fusion.eval`}</Code>

          <H id="architecture">Architecture</H>
          <p>Six stages: <span className="text-[var(--text)]">Collect → Extract → Correlate → Fuse → Attribute → Seal</span>. The browser talks only to a server-side proxy, so it never learns the engine URL or holds a key. The engine holds every third-party key; only 32-byte hashes ever reach the chain.</p>
          <ul className="space-y-1 pl-4">
            {[
              ["Infrastructure pivoting", "onion → clearnet via certificate reuse, favicon hash, exposed vhost"],
              ["Cross-market identity graph", "Splink blocking, Neo4j GDS resolution; only hard identifiers form an actor"],
              ["Stylometry & behaviour", "char n-grams, function words, Hinglish markers, rebrand change-points"],
              ["Blockchain flow", "wallet clustering to tagged off-ramps"],
              ["Evidence fusion", "likelihood ratios, root-cause collapse, calibration, conformal risk control"],
            ].map(([t, b]) => (
              <li key={t} className="list-disc"><span className="text-[var(--text)]">{t}</span> — {b}</li>
            ))}
          </ul>

          <H id="confidence">Confidence model</H>
          <p>Each signal becomes a likelihood ratio; signals are grouped by why they agree and only the strongest survives per group, so one fact is never counted twice. Each group is dampened by its measured reliability.</p>
          <Code>{`odds = prior_odds × Π (LR_root ^ r_root)
p    = odds / (1 + odds)`}</Code>
          <p>On the worked example this gives <span className="conf-high">0.84</span> where naive stacking gives <span className="text-[var(--muted-2)]">0.999</span>. Isotonic regression calibrates the score; split-conformal prediction bounds the false-merge rate at a chosen risk budget — measured at <span className="conf-high">3.1%</span> for α = 0.05.</p>

          <H id="custody">Chain of custody</H>
          <p>Every analyst action is canonically serialised, keccak-256 hashed, chained to its predecessor and signed with an Ed25519 key. The case Merkle root is anchored on chain. A single record verifies against its inclusion proof without disclosing the rest of the case.</p>
          <p>When the network is down it seals to a local chain and says so — the badge reads <span className="text-[var(--text)]">LOCAL CHAIN</span> and no explorer link is shown, because a public link on a local transaction would be a fabricated trail.</p>

          <H id="api">API reference</H>
          <p>All routes are proxied under <span className="mono text-[var(--text)]">/api/engine/…</span>.</p>
          <Code>{`GET  /actors?q=&min_confidence=      resolved actors, ranked
GET  /actor/{id}                     full dossier
GET  /actor/{id}/timeline            per-persona activity
GET  /export/actor/{id}.{json,csv}   PS-shaped export
GET  /fusion/example                 the 0.84 worked example
GET  /fusion/pair/{id}               a pair's evidence trail
GET  /fusion/threshold?alpha=        conformal threshold
POST /audit/case/{id}/seal           anchor the Merkle root
POST /audit/verify                   green / red with failing index`}</Code>

          <H id="metrics">Measured results</H>
          <div className="overflow-x-auto">
            <table className="mono w-full text-[11px]">
              <tbody>
                {[
                  ["Calibrated confidence (example)", "0.84 vs naive 0.999"],
                  ["False-merge rate @ α=0.05", "3.1%, guarantee holds"],
                  ["Precision / F1 at τ", "1.000 / 0.938"],
                  ["Brier / ECE", "0.0053 / 0.0051"],
                  ["Actors resolved (testbed)", "123"],
                  ["Cost to run", "₹0, no key required"],
                ].map(([k, v]) => (
                  <tr key={k} className="border-t border-[var(--border)]">
                    <td className="py-1.5 pr-4 text-[var(--muted)]">{k}</td>
                    <td className="py-1.5 text-right text-[var(--text)]">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <H id="limits">Limits</H>
          <ul className="space-y-1 pl-4">
            {[
              "It does not break Tor and never claims to. Attribution is correlation of leaked footprints.",
              "Behavioural analysis runs on labelled synthetic ground truth, because the public archive we ingest carries no timestamps.",
              "Stylometry is the weakest signal and is weighted accordingly.",
              "Every source is a public index; nothing is scraped from a live market.",
            ].map((t) => (
              <li key={t} className="list-disc">{t}</li>
            ))}
          </ul>

          <p className="mono border-t border-[var(--border)] pt-6 text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
            PRAHARI · प्रहरी · SIH 2026 PS 26151 · Team Vasiliades
          </p>
        </article>
      </div>
    </div>
  );
}
