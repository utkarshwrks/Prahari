/**
 * SESSION HARDENING AND CSRF (DEC-059).
 *
 * The Command Panel makes session theft materially more valuable than it was:
 * before, a stolen cookie let someone read investigative data; now it could let
 * them purge it. So the session model gets an absolute cap, a revocation list
 * the user can see and act on, and a CSRF token on every mutating request.
 *
 * The registry is in-process (DEC-046 again, same trade, same stated
 * limitation). It fails CLOSED in the way that matters: a session unknown to
 * this node is treated as revoked, so a restart logs everyone out rather than
 * trusting a token it has no record of.
 */
import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Rotate the JWT this often. Short, so a leaked token expires quickly. */
export const JWT_TTL_SECONDS = 15 * 60;

/**
 * Absolute cap, regardless of activity. Eight hours is one shift: an analyst
 * re-authenticates when they come back, and a session left open overnight on an
 * unattended machine is not still valid in the morning.
 */
export const ABSOLUTE_SESSION_SECONDS = 8 * 60 * 60;

export interface SessionRecord {
  id: string;
  userId: string;
  email: string;
  role: string;
  createdAt: number;
  lastSeenAt: number;
  /** Coarse, for the "active sessions" list. Never a precise fingerprint. */
  userAgent: string;
  ip: string;
  revokedAt: number | null;
  revokedReason: string | null;
}

const sessions = new Map<string, SessionRecord>();
const MAX_SESSIONS = 10_000;

export function newSessionId(): string {
  return randomBytes(24).toString("base64url");
}

export function register(
  input: Omit<SessionRecord, "createdAt" | "lastSeenAt" | "revokedAt" | "revokedReason">,
  atMs: number = Date.now()
): SessionRecord {
  if (sessions.size >= MAX_SESSIONS) {
    const oldest = sessions.keys().next().value;
    if (oldest !== undefined) sessions.delete(oldest);
  }
  const rec: SessionRecord = {
    ...input,
    createdAt: atMs,
    lastSeenAt: atMs,
    revokedAt: null,
    revokedReason: null,
  };
  sessions.set(rec.id, rec);
  return rec;
}

export type SessionState =
  | { valid: true; session: SessionRecord }
  | { valid: false; reason: "unknown" | "revoked" | "expired" };

/**
 * Is this session still usable?
 *
 * An unknown id is REVOKED, not accepted. That is the fail-closed direction: a
 * process restart drops the registry, and the alternative -- trusting any
 * well-signed token whose session we have no record of -- would make the
 * revocation list decorative.
 */
export function check(id: string, atMs: number = Date.now()): SessionState {
  const s = sessions.get(id);
  if (!s) return { valid: false, reason: "unknown" };
  if (s.revokedAt !== null) return { valid: false, reason: "revoked" };
  if ((atMs - s.createdAt) / 1000 > ABSOLUTE_SESSION_SECONDS) {
    return { valid: false, reason: "expired" };
  }
  s.lastSeenAt = atMs;
  return { valid: true, session: s };
}

export function revoke(id: string, reason: string, atMs: number = Date.now()): boolean {
  const s = sessions.get(id);
  if (!s || s.revokedAt !== null) return false;
  s.revokedAt = atMs;
  s.revokedReason = reason;
  return true;
}

/**
 * Revoke every session a user holds.
 *
 * Called on role change and on password reset. A role change that left old
 * sessions running would mean a demoted user keeps their old permissions until
 * their token happens to expire, which is the whole point of doing this.
 */
export function revokeAllFor(userId: string, reason: string, atMs: number = Date.now()): number {
  let n = 0;
  for (const s of sessions.values()) {
    if (s.userId === userId && s.revokedAt === null) {
      s.revokedAt = atMs;
      s.revokedReason = reason;
      n++;
    }
  }
  return n;
}

/** The user's own sessions, for the visible "active sessions" list. */
export function listFor(userId: string): SessionRecord[] {
  return [...sessions.values()]
    .filter((s) => s.userId === userId)
    .sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

export function resetSessions(): void {
  sessions.clear();
}

// ---------------------------------------------------------------------------
// CSRF
// ---------------------------------------------------------------------------

/**
 * A double-submit token bound to the session.
 *
 * The cookie is `SameSite=Lax`, which already blocks cross-site POSTs from a
 * plain form. This is the second layer, because Lax has real gaps -- a
 * top-level GET-then-POST navigation, and browsers that treat Lax loosely --
 * and because the Command Panel's mutations are the kind you cannot undo.
 *
 * Derived from the session id and the secret rather than stored, so there is no
 * second registry to keep in step and a restart does not invalidate tokens
 * independently of sessions.
 */
export function csrfToken(sessionId: string, secret: string): string {
  return createHash("sha256").update(`csrf:${secret}:${sessionId}`).digest("base64url");
}

export function verifyCsrf(sessionId: string, secret: string, submitted: string | null): boolean {
  if (!submitted) return false;
  const expected = Buffer.from(csrfToken(sessionId, secret));
  const got = Buffer.from(submitted);
  // Length check first: timingSafeEqual throws on a mismatch, and a thrown
  // exception inside a guard is an availability bug waiting to happen.
  if (expected.length !== got.length) return false;
  return timingSafeEqual(expected, got);
}

/** Cookie attributes for the session cookie. `Secure` only where it can work. */
export function cookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: ABSOLUTE_SESSION_SECONDS,
  };
}
