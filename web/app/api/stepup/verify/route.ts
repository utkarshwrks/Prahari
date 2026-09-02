import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { AUTH_SECRET } from "@/lib/authConfig";
import { check as checkSession, verifyCsrf } from "@/lib/sessions";
import { grantStepUp, recoveryRemaining, verifyStepUp } from "@/lib/totp";
import { persist, stateFor } from "@/lib/totpStore";
import { pepper } from "@/lib/passwords";
import { ipAllowed } from "@/lib/ipAllowlist";
import { LIMITS } from "@/lib/adminGuard";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Verify a step-up code and grant a server-side token (DEC-059).
 *
 * The response carries no token: the grant is recorded against the session id
 * server-side, and the client already holds that in its httpOnly cookie. There
 * is deliberately nothing here for a client to store, replay or forge.
 */
export async function POST(req: NextRequest) {
  if (!ipAllowed(req.headers)) {
    return NextResponse.json({ ok: false, detail: "Not permitted from this address." }, { status: 403 });
  }
  const token = await getToken({ req, secret: AUTH_SECRET });
  const sid = typeof token?.sid === "string" ? token.sid : null;
  if (!token || !sid || !checkSession(sid).valid) {
    return NextResponse.json({ ok: false, detail: "Sign in to continue." }, { status: 401 });
  }
  if (!verifyCsrf(sid, AUTH_SECRET, req.headers.get("x-prahari-csrf"))) {
    return NextResponse.json({ ok: false, detail: "Invalid CSRF token." }, { status: 403 });
  }

  const userId = String(token.id ?? "");
  const email = String(token.email ?? "").toLowerCase();

  // Per ACCOUNT, not per IP: the account is the thing worth protecting, and a
  // distributed attack against one account must still be throttled.
  const cfg = LIMITS["totp-verify"];
  const rl = rateLimit(`totp-verify:acct:${email}`, cfg.limit, cfg.windowMs);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, detail: `Too many attempts. Try again in ${rl.retryAfterSeconds}s.` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const state = await stateFor(userId);
  if (!state) {
    return NextResponse.json(
      { ok: false, detail: "No authenticator is enrolled for this account.", needsEnrolment: true },
      { status: 409 }
    );
  }

  const outcome = verifyStepUp(state, String(body.code ?? ""), pepper());
  // Persist regardless of the outcome: a successful verification must record
  // the code as spent, and a failure may still have consumed a recovery hash.
  await persist(userId, state);

  if (!outcome.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: outcome.reason,
        detail:
          outcome.reason === "replayed"
            ? "That code has already been used. Wait for your authenticator to show the next one."
            : outcome.reason === "recovery-spent"
              ? "That recovery code has already been used."
              : outcome.reason === "malformed"
                ? "Enter the six digits from your authenticator, or a recovery code."
                : "That code was not accepted.",
        attemptsRemaining: rl.remaining,
      },
      { status: 403 }
    );
  }

  grantStepUp(sid, outcome.via);
  return NextResponse.json({
    ok: true,
    via: outcome.via,
    recoveryRemaining: recoveryRemaining(state),
    detail:
      outcome.via === "recovery"
        ? "Accepted a recovery code. It cannot be used again."
        : "Step-up granted for fifteen minutes. Destructive actions will ask again.",
  });
}
