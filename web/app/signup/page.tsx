import type { Metadata } from "next";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";
import SignupForm from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Sign Up · PRAHARI",
  description: "Create a PRAHARI officer account.",
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Create Account"
      subtitle="Register a new officer account for the control room."
      footer={
        <>
          Already registered?{" "}
          <Link href="/login" className="text-red-bright hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
