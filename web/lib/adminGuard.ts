/**
 * THE SERVER-SIDE GUARD (DEC-058).
 *
 * Every Command Panel request passes through here. The middleware also guards
 * `/command/*`, and the UI also hides what a role cannot do — but those are a
 * convenience and a routing rule respectively. THIS is the control.
 *
 * The distinction is not pedantry. `middleware.ts` runs on the Edge runtime and
 * cannot read the in-process step-up store; the UI runs in a browser we do not
 * control. If either were the only check, a hand-rolled `fetch` from the
 * console would be enough to purge a retention policy.
 *
 * Order matters and is asserted in `authz.test.ts`:
 *
 *   IP allowlist → session validity → CSRF → role → step-up → rate limit
 *
 * The allowlist is first because a deployment that restricted the panel to an
 * office range means it, and it should not be spending CPU on bcrypt or on
 * ledger writes for traffic it has already decided to refuse.
 */
import "server-only";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { AUTH_SECRET, IS_PRODUCTION } from "./authConfig";
import { authorize, isDestructive, statusFor, type AuthzDecision } from "./rbac";
import { check as checkSession, verifyCsrf } from "./sessions";
import { stepUpAge } from "./totp";
import { clientKey, rateLimit } from "./rateLimit";
import { ipAllowed } from "./ipAllowlist";

export interface GuardContext {
  path: string;
  method: string;
  userId: string;
  email: string;
  role: string;
  sessionId: string;
  decision: AuthzDecision;
}

export type GuardResult =
  | { ok: true; ctx: GuardContext }
  | { ok: false; status: number; reason: string; detail: string; retryAfter?: number };

/**
 * Per-surface rate limits (the DEC-046 principle: key to what is worth
 * protecting, not to a uniform number).
 *
 * TOTP verify is per ACCOUNT, because the thing worth protecting is the
 * account, and a distributed attack from many IPs against one account must
 * still be throttled. Role changes and bulk mutations are per ACTING ADMIN,
 * because there the risk is one authorised person doing something sweeping —
 * whether by mistake or under duress — and an IP key would not slow that down
 * at all.
 */
export const LIMITS = {
  "totp-verify": { limit: 5, windowMs: 5 * 60 * 1000, key: "account" as const },
  "role-change": { limit: 10, windowMs: 60 * 60 * 1000, key: "admin" as const },
  "bulk-mutation": { limit: 3, windowMs: 60 * 60 * 1000, key: "admin" as const },
  export: { limit: 20, windowMs: 60 * 60 * 1000, key: "account" as const },
} as const;

export type LimitName = keyof typeof LIMITS;

/** Which limit, if any, applies to an admin path. */
export function limitFor(path: string, method: string): LimitName | null {
  const p = path.replace(/^\/+/, "");
  if (p.startsWith("stepup/verify")) return "totp-verify";
  if (p.startsWith("users") && method === "PATCH") return "role-change";
  if (p.startsWith("bulk/") || p.startsWith("retention/")) return "bulk-mutation";
  if (p.startsWith("export") || p.startsWith("reports")) return "export";
  return null;
}

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export async function guard(req: NextRequest, path: string): Promise<GuardResult> {
  const method = req.method.toUpperCase();

  // 1 — IP allowlist. Off by default; a deployment that sets it means it.
  if (!ipAllowed(req.headers)) {
    return {
      ok: false,
      status: 403,
      reason: "ip-not-allowed",
      detail: "This address is not in ADMIN_IP_ALLOWLIST.",
    };
  }

  // 2 — session. The JWT proves identity; the registry proves it is still live.
  const token = await getToken({ req, secret: AUTH_SECRET });
  const sessionId = typeof token?.sid === "string" ? token.sid : null;
  if (!token || !sessionId) {
    return { ok: false, status: 401, reason: "no-session", detail: "Sign in to continue." };
  }

  const state = checkSession(sessionId);
  if (!state.valid) {
    return {
      ok: false,
      status: 401,
      reason: `session-${state.reason}`,
      // Naming which of the three happened is safe -- the caller already holds
      // a valid signature, so this leaks nothing they did not have -- and it
      // is the difference between "sign in again" and "your access was
      // revoked", which the user needs to know.
      detail:
        state.reason === "revoked"
          ? "This session was revoked. Sign in again."
          : state.reason === "expired"
            ? "This session reached its maximum age. Sign in again."
            : "This session is no longer recognised. Sign in again.",
    };
  }

  const role = String(token.role ?? "");
  const userId = String(token.id ?? "");
  const email = String(token.email ?? "");

  // 3 — CSRF, on every mutating request.
  if (MUTATING.has(method)) {
    const submitted = req.headers.get("x-prahari-csrf");
    if (!verifyCsrf(sessionId, AUTH_SECRET, submitted)) {
      return {
        ok: false,
        status: 403,
        reason: "csrf",
        detail: "Missing or invalid CSRF token. Reload the page and retry.",
      };
    }
  }

  // 4 & 5 — role and step-up, from the one shared decision table.
  const decision = authorize({
    path,
    method,
    role,
    stepUpAgeSeconds: stepUpAge(sessionId),
  });
  if (!decision.allowed) {
    return {
      ok: false,
      status: statusFor(decision.reason),
      reason: decision.reason,
      detail:
        decision.reason === "step-up-required"
          ? "This action needs a step-up code from your authenticator."
          : decision.reason === "fresh-step-up-required"
            ? "This action is destructive and needs a step-up code entered just now."
            : decision.reason === "insufficient-role"
              ? `Your role (${role || "none"}) does not hold the ${decision.route?.permission} permission.`
              : "Not available.",
    };
  }

  // 6 — rate limit, last: a refusal above should not consume anyone's budget.
  const name = limitFor(path, method);
  if (name) {
    const cfg = LIMITS[name];
    const key =
      cfg.key === "account" ? `${name}:acct:${email.toLowerCase()}` : `${name}:admin:${userId}`;
    const rl = rateLimit(key, cfg.limit, cfg.windowMs);
    if (!rl.ok) {
      return {
        ok: false,
        status: 429,
        reason: `rate-limited:${name}`,
        detail: `Too many ${name.replace("-", " ")} attempts. Try again in ${rl.retryAfterSeconds}s.`,
        retryAfter: rl.retryAfterSeconds,
      };
    }
  }

  return {
    ok: true,
    ctx: { path, method, userId, email, role, sessionId, decision },
  };
}

/** Unused import guard: `clientKey` is exported for handlers keying by IP. */
export { clientKey };

/**
 * Does this request need a ledger entry?
 *
 * Every mutation does. Reads do not — a read-heavy panel would bury the
 * chain in noise and make the interesting entries harder to find, and reads
 * are already covered by `/admin/audit/activity`.
 */
export function needsLedgerEntry(method: string): boolean {
  return MUTATING.has(method.toUpperCase());
}

export function isDestructiveRequest(path: string, method: string): boolean {
  const d = authorize({ path, method, role: "admin", stepUpAgeSeconds: 0 });
  return Boolean(d.route?.destructive) || isDestructive(path.split("/")[0] ?? "");
}

export { IS_PRODUCTION };
