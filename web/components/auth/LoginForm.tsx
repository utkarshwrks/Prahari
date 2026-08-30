"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("analyst@prahari.local");
  const [password, setPassword] = useState("prahari123");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.ok) router.push("/workbench");
    else setError("Those credentials were not accepted.");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="mono mb-1 block text-[10px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
          Email
        </span>
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
          className="mono w-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[12px] text-[var(--text)] focus:border-[var(--accent-dim)] focus:outline-none"
        />
      </label>
      <label className="block">
        <span className="mono mb-1 block text-[10px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
          Password
        </span>
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
          className="mono w-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[12px] text-[var(--text)] focus:border-[var(--accent-dim)] focus:outline-none"
        />
      </label>

      {error && (
        <p role="alert" className="mono text-[10px] text-[var(--c-high)]">{error}</p>
      )}

      <button
        type="submit" disabled={busy}
        className="mono flex w-full items-center justify-center gap-2 border border-[var(--accent-dim)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] py-2.5 text-[11px] uppercase tracking-[0.18em] text-[var(--c-high)] transition hover:bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] disabled:opacity-50"
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {busy ? "Signing in" : "Open workbench"}
      </button>

      <p className="mono text-center text-[9px] leading-relaxed text-[var(--muted-2)]">
        Demo analyst account, pre-filled. Disabled entirely in production.
      </p>
    </form>
  );
}
