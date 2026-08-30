"use client";

import { useState } from "react";
import { getCsrfToken, signIn } from "next-auth/react";
import { Loader2, ShieldCheck } from "lucide-react";

export default function LoginForm() {
  const [email, setEmail] = useState("analyst@prahari.local");
  const [password, setPassword] = useState("prahari123");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Warm the CSRF token first so the very first click works cleanly.
      await getCsrfToken();
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.ok && !res.error) {
        // HARD navigation, not router.push. A client-side push races the
        // session cookie: middleware on /workbench can run before the cookie
        // is written and bounce back to /login. A full navigation guarantees
        // the fresh cookie is sent and any stale v1 cookie is overwritten.
        window.location.assign("/workbench");
        return;
      }
      setError("Those credentials were not accepted. Try again.");
    } catch {
      setError("Sign-in failed. Is the app reachable?");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <Field label="Email" type="email" value={email} onChange={setEmail} />
      <Field label="Password" type="password" value={password} onChange={setPassword} />

      {error && (
        <p role="alert" className="mono flex items-center gap-1.5 text-[10px] text-[var(--c-high)]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="group relative mono flex w-full items-center justify-center gap-2 overflow-hidden border border-[var(--accent-dim)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] py-3 text-[11px] uppercase tracking-[0.2em] text-[var(--c-high)] transition hover:bg-[color-mix(in_srgb,var(--accent)_22%,transparent)] disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
        {busy ? "Signing in" : "Open workbench"}
      </button>

      <p className="mono text-center text-[9px] leading-relaxed text-[var(--muted-2)]">
        Demo analyst account, pre-filled. Disabled entirely in production.
      </p>
    </form>
  );
}

function Field({
  label, type, value, onChange,
}: { label: string; type: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mono mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="mono w-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-[12px] text-[var(--text)] transition focus:border-[var(--accent-dim)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-dim)]"
      />
    </label>
  );
}
