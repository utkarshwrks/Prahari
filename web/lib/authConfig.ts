// Edge-safe auth constants shared by both the NextAuth route handler (Node)
// and middleware (Edge). No Node-only imports here (no fs / bcrypt), so this
// module is safe to import from middleware.ts.

/**
 * PRODUCTION HARDENING (Phase 10).
 *
 * v1 fell back to a hardcoded secret so `npm install && npm run dev` worked
 * with zero configuration. That is the right trade for a demo and the wrong
 * one for a deployment: a known signing secret means anyone can forge a
 * session token for any account, including an officer's.
 *
 * The fallback now exists ONLY outside production. In production a missing
 * NEXTAUTH_SECRET stops the app at import time rather than silently accepting
 * forged sessions -- failing loudly at boot is recoverable, failing silently
 * in the field is not.
 */

export const IS_PRODUCTION = process.env.NODE_ENV === "production";

const DEV_SECRET = "prahari-local-development-secret-do-not-use-in-production-8f3a";

function resolveSecret(): string {
  const configured = process.env.NEXTAUTH_SECRET?.trim();
  if (configured) {
    if (IS_PRODUCTION && configured === DEV_SECRET) {
      throw new Error(
        "PRAHARI refuses to start: NEXTAUTH_SECRET is set to the development " +
          "default. Generate one with `openssl rand -base64 32`."
      );
    }
    return configured;
  }
  if (IS_PRODUCTION) {
    throw new Error(
      "PRAHARI refuses to start in production without NEXTAUTH_SECRET. " +
        "A known signing secret allows anyone to forge a session for any " +
        "account. Generate one with `openssl rand -base64 32`."
    );
  }
  return DEV_SECRET;
}

export const AUTH_SECRET = resolveSecret();

export const SIGNIN_PAGE = "/login";

/**
 * The seeded demo officer is disabled in production.
 *
 * Its credentials are printed on the login page and committed to this
 * repository, which is correct for a pitch and indefensible for a deployment
 * holding investigative data.
 */
export const DEMO_ACCOUNT_ENABLED = !IS_PRODUCTION;

/** Roles. `officer` may seal and verify; `analyst` may investigate. */
export type Role = "officer" | "analyst";

export const ROLE_PERMISSIONS: Record<Role, readonly string[]> = {
  officer: ["read", "investigate", "assign", "seal", "verify", "export"],
  analyst: ["read", "investigate", "verify"],
};

export function can(role: string | undefined, permission: string): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role as Role];
  return Boolean(perms?.includes(permission));
}
