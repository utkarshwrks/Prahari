"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, LogIn, Zap, AlertTriangle } from "lucide-react";

const DEMO_EMAIL = "officer@mp.gov.in";
const DEMO_PASSWORD = "prahari123";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doLogin(em: string, pw: string) {
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email: em,
      password: pw,
      redirect: false,
    });
    if (res?.error) {
      setError("Invalid credentials. Check your email and password.");
      setLoading(false);
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div>
      {/* Demo account callout */}
      <div className="mb-5 border border-red/40 bg-red/[0.06] p-4">
        <div className="mono mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-red-bright">
          <Zap className="h-3.5 w-3.5" /> Demo Account
        </div>
        <div className="mono space-y-0.5 text-[12px] text-muted">
          <div>
            email: <span className="text-text">{DEMO_EMAIL}</span>
          </div>
          <div>
            pass: <span className="text-text">{DEMO_PASSWORD}</span>
          </div>
        </div>
        <button
          onClick={() => {
            setEmail(DEMO_EMAIL);
            setPassword(DEMO_PASSWORD);
            doLogin(DEMO_EMAIL, DEMO_PASSWORD);
          }}
          disabled={loading}
          className="btn btn-primary mt-3 w-full !py-2.5"
        >
          <Zap className="h-4 w-4" /> Use Demo Account
        </button>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <span className="hairline flex-1" />
        <span className="mono text-[10px] uppercase tracking-widest text-muted-2">
          or sign in
        </span>
        <span className="hairline flex-1" />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          doLogin(email, password);
        }}
        className="space-y-4"
      >
        <div>
          <label className="label mb-1.5 block">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="officer@mp.gov.in"
            className="field mono"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="label mb-1.5 block">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="field mono"
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 border border-red/50 bg-red/10 px-3 py-2 text-[12px] text-red-bright">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn btn-ghost w-full">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Authenticating…
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4" /> Sign In
            </>
          )}
        </button>
      </form>
    </div>
  );
}
