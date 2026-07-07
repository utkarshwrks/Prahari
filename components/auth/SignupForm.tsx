"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, UserPlus, AlertTriangle } from "lucide-react";

export default function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      setError(data.error || "Could not create account.");
      setLoading(false);
      return;
    }

    // auto sign-in the new account
    const signInRes = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (signInRes?.error) {
      setError("Account created, but sign-in failed. Try logging in.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label mb-1.5 block">Full Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Insp. A. Sharma"
          className="field"
          autoComplete="name"
        />
      </div>
      <div>
        <label className="label mb-1.5 block">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@mp.gov.in"
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
          placeholder="min. 6 characters"
          className="field mono"
          autoComplete="new-password"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 border border-red/50 bg-red/10 px-3 py-2 text-[12px] text-red-bright">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <button type="submit" disabled={loading} className="btn btn-primary w-full">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Creating account…
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4" /> Create Account
          </>
        )}
      </button>
    </form>
  );
}
