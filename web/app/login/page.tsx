import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Login · PRAHARI",
  description: "Secure access to the PRAHARI control room.",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Launch Console"
      subtitle="Authenticate to enter the Jabalpur control room."
      footer={
        <>
          No account?{" "}
          <Link href="/signup" className="text-red-bright hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <Suspense
        fallback={<div className="mono text-xs text-muted">Loading…</div>}
      >
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
