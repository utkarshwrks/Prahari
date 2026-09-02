import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { AUTH_SECRET } from "@/lib/authConfig";
import { check as checkSession, csrfToken, listFor } from "@/lib/sessions";
import { stepUpAge } from "@/lib/totp";
import { isEnrolled } from "@/lib/totpStore";
import { FRESH_STEP_UP_SECONDS, STEP_UP_TTL_SECONDS, permissionsOf } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/**
 * What the Command Panel needs to render itself honestly.
 *
 * The CSRF token is minted here rather than embedded in a page, so it is always
 * current for the live session. It is safe to hand to same-origin script: it is
 * derived from the session id the browser already holds, and its whole job is
 * to prove the request came from a page on this origin.
 */
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: AUTH_SECRET });
  const sid = typeof token?.sid === "string" ? token.sid : null;
  if (!token || !sid) {
    return NextResponse.json({ ok: false, authenticated: false }, { status: 200 });
  }
  const state = checkSession(sid);
  if (!state.valid) {
    return NextResponse.json(
      { ok: false, authenticated: false, reason: state.reason },
      { status: 200 }
    );
  }

  const userId = String(token.id ?? "");
  const age = stepUpAge(sid);

  return NextResponse.json({
    ok: true,
    authenticated: true,
    role: String(token.role ?? ""),
    permissions: permissionsOf(String(token.role ?? "")),
    enrolled: await isEnrolled(userId),
    csrf: csrfToken(sid, AUTH_SECRET),
    stepUp: {
      // null age means no step-up at all -- distinct from an expired one, and
      // the UI says which so the analyst knows whether to expect a prompt.
      ageSeconds: age,
      valid: age !== null && age <= STEP_UP_TTL_SECONDS,
      fresh: age !== null && age <= FRESH_STEP_UP_SECONDS,
      ttlSeconds: STEP_UP_TTL_SECONDS,
      freshSeconds: FRESH_STEP_UP_SECONDS,
    },
    sessions: listFor(userId).map((s) => ({
      id: s.id,
      current: s.id === sid,
      createdAt: new Date(s.createdAt).toISOString(),
      lastSeenAt: new Date(s.lastSeenAt).toISOString(),
      revoked: s.revokedAt !== null,
    })),
  });
}
