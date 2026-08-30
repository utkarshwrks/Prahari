import Link from "next/link";
import { ArrowLeft, Fingerprint, Lock, Radar } from "lucide-react";
import Logo from "@/components/ui/Logo";
import LoginForm from "@/components/auth/LoginForm";
import GlobeStage from "@/components/three/GlobeStage";

export const metadata = { title: "Sign in — PRAHARI" };

const TRUST = [
  { icon: Lock, label: "Signed & chained", note: "Ed25519 · keccak Merkle" },
  { icon: Radar, label: "Autonomous intake", note: "public indexes only" },
  { icon: Fingerprint, label: "Calibrated", note: "ECE 0.005 · α 0.05" },
];

export default function Page() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      {/* the 3D hero component, as an atmospheric backdrop */}
      <div className="pointer-events-none absolute right-[-12%] top-1/2 hidden h-[130%] w-[62%] -translate-y-1/2 opacity-90 lg:block">
        <GlobeStage />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[var(--bg)] via-[var(--bg)]/80 to-transparent" />

      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/"><Logo /></Link>
        <Link href="/" className="mono flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted-2)] transition hover:text-[var(--text)]">
          <ArrowLeft className="h-3 w-3" /> Back
        </Link>
      </header>

      <div className="relative z-10 flex flex-1 items-center px-5 sm:px-8">
        <div className="w-full max-w-md rise">
          <p className="mono text-[10px] uppercase tracking-[0.24em] text-[var(--muted-2)]">
            Analyst access
          </p>
          <h1 className="display mt-3 text-4xl font-bold leading-[1.05] tracking-tight">
            Open the <span className="grad-text">attribution workbench</span>.
          </h1>
          <p className="mono mt-4 max-w-sm text-[11px] leading-relaxed text-[var(--muted)]">
            Every action inside is canonically serialised, keccak-hashed, chained
            and signed. You are entering a record that cannot be quietly edited.
          </p>

          <div className="glass mt-7 p-6">
            <LoginForm />
          </div>

          <dl className="mt-6 grid grid-cols-3 gap-2">
            {TRUST.map((t) => (
              <div key={t.label} className="glass px-3 py-2.5">
                <t.icon className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} strokeWidth={1.75} />
                <dt className="mono mt-1.5 text-[9px] uppercase tracking-[0.12em] text-[var(--text)]">{t.label}</dt>
                <dd className="mono mt-0.5 text-[8.5px] leading-tight text-[var(--muted-2)]">{t.note}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <footer className="relative z-10 px-5 py-5 sm:px-8">
        <p className="mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
          PRAHARI · प्रहरी · SIH 2026 PS 26151 · Team Vasiliades
        </p>
      </footer>
    </div>
  );
}
