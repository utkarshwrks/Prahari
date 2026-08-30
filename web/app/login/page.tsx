import Link from "next/link";
import Logo from "@/components/ui/Logo";
import LoginForm from "@/components/auth/LoginForm";

export const metadata = { title: "Sign in — PRAHARI" };

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="hairline flex items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/"><Logo /></Link>
        <Link href="/" className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted-2)] transition hover:text-[var(--text)]">
          Back
        </Link>
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <h1 className="display text-2xl font-bold text-[var(--text)]">Analyst sign-in</h1>
          <p className="mono mt-1.5 text-[10px] leading-relaxed text-[var(--muted-2)]">
            Every action you take in the workbench is signed and appended to a
            tamper-evident ledger.
          </p>
          <div className="panel marked mt-6 p-5">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
