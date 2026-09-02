/**
 * STEP-UP AUTHENTICATION (DEC-059).
 *
 * Every write in the Command Panel requires a fresh TOTP proof. The threat this
 * addresses is specific: a session cookie stolen from an unlocked laptop, or an
 * analyst who walked away. A password protects login; nothing protected the
 * mutations after it.
 *
 * `otplib` (MIT) does the RFC 6238 arithmetic. Everything around it — the
 * replay window, the recovery codes, the server-side token store — is here,
 * because those are the parts that get security wrong.
 *
 * FOUR PROPERTIES, each of which `totp.test.ts` pins:
 *
 *   1. A code is single-use. Accepting the same six digits twice inside its
 *      30-second window means a shoulder-surfed code works for anyone who saw
 *      it, which defeats the point of a second factor.
 *   2. Drift is ±1 window and no more. Wider is friendlier and materially
 *      weaker: every extra window is another 30 seconds of validity for a code
 *      an attacker observed.
 *   3. Recovery codes are hashed at rest and single-use. They are password
 *      equivalents; storing them in the clear would be worse than not having
 *      them.
 *   4. The step-up token lives SERVER-SIDE against the session. A client-held
 *      claim that says "I did TOTP" is a claim the client can forge.
 */
import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { authenticator } from "otplib";
import { STEP_UP_TTL_SECONDS } from "./rbac";

/**
 * ±1 window. otplib's `window` option takes [past, future].
 *
 * A code is valid for its own 30-second step plus one step either side, so 90
 * seconds of wall-clock tolerance for a phone whose clock has drifted. Any
 * wider and an observed code stays usable long enough to be typed elsewhere.
 */
authenticator.options = { window: [1, 1], step: 30, digits: 6 };

export const TOTP_ISSUER = "PRAHARI";
export const RECOVERY_CODE_COUNT = 8;

/**
 * Check a code AT A GIVEN MOMENT.
 *
 * otplib verifies against its own configured epoch, which defaults to the real
 * clock -- so an injected `atMs` used only for replay bookkeeping would drift
 * apart from the cryptographic check. Found by the drift tests: a code
 * generated for "two windows ago" verified as valid, because the check ignored
 * the simulated time entirely and validated against now.
 *
 * The options object is global on the otplib singleton, so it is set and
 * restored around the call. Single-threaded per request, and restoring in
 * `finally` means a throw cannot leave a stale epoch behind for the next
 * caller -- which would be a much worse bug than the one this fixes.
 */
function checkAt(code: string, secret: string, atMs: number): boolean {
  const previous = authenticator.options;
  try {
    authenticator.options = { ...previous, epoch: atMs };
    return authenticator.check(code, secret);
  } catch {
    return false; // a malformed secret must not throw into the handler
  } finally {
    authenticator.options = previous;
  }
}

/** Generate the code a phone would show at `atMs`. Exported for tests only. */
export function generateAt(secret: string, atMs: number): string {
  const previous = authenticator.options;
  try {
    authenticator.options = { ...previous, epoch: atMs };
    return authenticator.generate(secret);
  } finally {
    authenticator.options = previous;
  }
}

// ---------------------------------------------------------------------------
// Enrolment
// ---------------------------------------------------------------------------

export interface Enrolment {
  secret: string;
  /** The otpauth:// URI a authenticator app scans. */
  uri: string;
  /** Plaintext recovery codes — shown ONCE, never stored in this form. */
  recoveryCodes: string[];
  /** What actually goes to disk. */
  recoveryHashes: string[];
}

/** A recovery code: 10 chars, Crockford-ish alphabet, no ambiguous glyphs. */
function recoveryCode(): string {
  // No 0/O, no 1/I/L. 31 symbols, so a 10-character code is ~49.6 bits --
  // still far beyond guessing, and legible off a printed sheet.
  const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}

/**
 * Hash a recovery code.
 *
 * SHA-256 with the pepper, not bcrypt. Recovery codes are 50 bits of genuine
 * entropy from a CSPRNG, so they are not brute-forceable from a hash the way a
 * human password is, and a fast hash means verification does not open a timing
 * or CPU-exhaustion path when someone pastes eight of them. The pepper means a
 * stolen database alone is not enough.
 */
export function hashRecoveryCode(code: string, pepper: string): string {
  return createHash("sha256")
    .update(`${pepper}:${code.trim().toUpperCase().replace(/-/g, "")}`)
    .digest("hex");
}

export function enrol(account: string, pepper: string): Enrolment {
  const secret = authenticator.generateSecret();
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, recoveryCode);
  return {
    secret,
    uri: authenticator.keyuri(account, TOTP_ISSUER, secret),
    recoveryCodes: codes,
    recoveryHashes: codes.map((c) => hashRecoveryCode(c, pepper)),
  };
}

// ---------------------------------------------------------------------------
// Verification, with replay protection
// ---------------------------------------------------------------------------

/** Which 30-second step a timestamp falls in. */
export function windowOf(atMs: number): number {
  return Math.floor(atMs / 1000 / 30);
}

export interface TotpState {
  secret: string;
  recoveryHashes: string[];
  /** (window, code) pairs already spent. Bounded; old entries are pruned. */
  usedCodes: { window: number; code: string }[];
  /** Recovery hashes already spent — never re-usable. */
  usedRecovery: string[];
}

export type VerifyOutcome =
  | { ok: true; via: "totp" | "recovery" }
  | { ok: false; reason: "malformed" | "invalid" | "replayed" | "recovery-spent" };

const isSixDigits = (s: string) => /^\d{6}$/.test(s.trim());

/**
 * Verify a step-up code and MUTATE `state` to record it as spent.
 *
 * Mutating rather than returning a new state is deliberate: replay protection
 * that the caller has to remember to persist is replay protection that will one
 * day not be persisted.
 */
export function verifyStepUp(
  state: TotpState,
  submitted: string,
  pepper: string,
  atMs: number = Date.now()
): VerifyOutcome {
  const code = submitted.trim().toUpperCase();

  if (isSixDigits(code)) {
    const w = windowOf(atMs);

    // Replay check FIRST. Checking validity first and replay second would
    // still work, but it means a replayed code takes the same code path as a
    // fresh one right up to the last moment -- and the ordering here is the
    // property the test names.
    if (state.usedCodes.some((u) => u.code === code && Math.abs(u.window - w) <= 1)) {
      return { ok: false, reason: "replayed" };
    }

    if (!checkAt(code, state.secret, atMs)) return { ok: false, reason: "invalid" };

    state.usedCodes.push({ window: w, code });
    // Keep only what replay protection can still need: the current window and
    // one either side. Unbounded growth would be a slow memory leak per user.
    state.usedCodes = state.usedCodes.filter((u) => Math.abs(u.window - w) <= 1);
    return { ok: true, via: "totp" };
  }

  // Recovery codes: 10 chars, possibly hyphenated.
  const bare = code.replace(/-/g, "");
  if (!/^[2-9A-HJKMNP-Z]{10}$/.test(bare)) return { ok: false, reason: "malformed" };

  const hash = hashRecoveryCode(bare, pepper);
  if (state.usedRecovery.includes(hash)) return { ok: false, reason: "recovery-spent" };

  // Constant-time compare against each stored hash. Both sides are fixed-length
  // hex, so length never leaks.
  const target = Buffer.from(hash, "hex");
  const match = state.recoveryHashes.some((h) => {
    const b = Buffer.from(h, "hex");
    return b.length === target.length && timingSafeEqual(b, target);
  });
  if (!match) return { ok: false, reason: "invalid" };

  state.usedRecovery.push(hash);
  return { ok: true, via: "recovery" };
}

/** How many recovery codes remain. Shown to the user; nagging is the point. */
export function recoveryRemaining(state: TotpState): number {
  return state.recoveryHashes.filter((h) => !state.usedRecovery.includes(h)).length;
}

// ---------------------------------------------------------------------------
// The step-up token store.
//
// SERVER-SIDE, keyed by session. The client receives nothing but an opaque
// handle it already has (its session id), so there is no claim for it to forge.
//
// In-process, like the rate limiter, and for the same reason (DEC-046): the
// playbook forbids Redis and a single-node district deployment does not need
// it. The limitation is the same one and is stated in the same place -- behind
// several instances a step-up proved on one node is not known to the others,
// so the analyst would be asked for a second code. Annoying, not unsafe: it
// fails CLOSED.
// ---------------------------------------------------------------------------

interface StepUp {
  sessionId: string;
  provenAt: number;
  via: "totp" | "recovery";
}

const stepUps = new Map<string, StepUp>();
const MAX_STEP_UPS = 5_000;

export function grantStepUp(
  sessionId: string,
  via: "totp" | "recovery",
  atMs: number = Date.now()
): void {
  if (stepUps.size >= MAX_STEP_UPS) {
    const oldest = stepUps.keys().next().value;
    if (oldest !== undefined) stepUps.delete(oldest);
  }
  stepUps.set(sessionId, { sessionId, provenAt: atMs, via });
}

/** Age of a session's step-up in seconds, or null when it has none. */
export function stepUpAge(sessionId: string, atMs: number = Date.now()): number | null {
  const s = stepUps.get(sessionId);
  if (!s) return null;
  const age = (atMs - s.provenAt) / 1000;
  if (age > STEP_UP_TTL_SECONDS) {
    stepUps.delete(sessionId); // expire on read, so the map self-cleans
    return null;
  }
  return age;
}

/** Drop a session's step-up. Called on logout, role change and password reset. */
export function revokeStepUp(sessionId: string): void {
  stepUps.delete(sessionId);
}

export function resetStepUps(): void {
  stepUps.clear();
}
