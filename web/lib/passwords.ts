/**
 * CREDENTIAL HANDLING (DEC-058).
 *
 * bcrypt stays — it is the right primitive and it is already in the tree. Three
 * things change:
 *
 *   1. COST FACTOR 12, up from 10. Roughly 4x the work per guess. A login takes
 *      ~250 ms instead of ~60 ms, which nobody notices and an offline cracker
 *      very much does.
 *   2. A PEPPER from the environment. bcrypt salts per-hash, which defeats
 *      rainbow tables but not an attacker who has the database and can guess
 *      offline. The pepper is not in the database, so a dump alone is not
 *      enough to start guessing.
 *   3. A POLICY ON SET AND RESET ONLY, never on login. Length and a breach-list
 *      check — no composition theatre. "At least one uppercase and one symbol"
 *      pushes people to `Password1!` and buys nothing; length and
 *      not-already-breached are the two rules that actually correlate with
 *      surviving a credential-stuffing attack.
 *
 * Existing hashes keep working. bcrypt encodes its cost in the hash, so a
 * cost-10 hash from before this change verifies exactly as it did, and is
 * upgraded transparently on the owner's next successful login.
 */
import "server-only";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const BCRYPT_COST = 12;
export const MIN_PASSWORD_LENGTH = 12;

/**
 * The pepper.
 *
 * Absent outside production, so a clone runs. In production its absence is a
 * boot-time failure, not a silent fallback — a hardcoded pepper is no pepper,
 * and the same reasoning as DEC-045's NEXTAUTH_SECRET applies exactly.
 */
export function pepper(): string {
  const configured = process.env.PASSWORD_PEPPER?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error(
      "PRAHARI refuses to start in production without PASSWORD_PEPPER. " +
        "Generate one with `openssl rand -base64 32`."
    );
  }
  return "prahari-local-development-pepper-not-for-production";
}

/** bcrypt over the peppered password. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(`${plain}${pepper()}`, BCRYPT_COST);
}

/**
 * Verify, accepting hashes made before the pepper existed.
 *
 * The un-peppered fallback is what stops this change locking out every account
 * created earlier. It is tried second, so a peppered hash never takes the
 * weaker path, and the result says which matched so the caller can re-hash.
 */
export async function verifyPassword(
  plain: string,
  hash: string
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (await bcrypt.compare(`${plain}${pepper()}`, hash)) {
    // Correct pepper. Re-hash only if the cost is now below policy.
    return { ok: true, needsRehash: costOf(hash) < BCRYPT_COST };
  }
  if (await bcrypt.compare(plain, hash)) {
    return { ok: true, needsRehash: true }; // legacy, un-peppered
  }
  return { ok: false, needsRehash: false };
}

/** The cost factor encoded in a bcrypt hash, or 0 if unreadable. */
export function costOf(hash: string): number {
  const m = /^\$2[aby]?\$(\d{2})\$/.exec(hash);
  return m ? Number(m[1]) : 0;
}

// ---------------------------------------------------------------------------
// The breach list
// ---------------------------------------------------------------------------

let breached: Set<string> | null = null;

/**
 * A bundled list of common passwords, checked OFFLINE.
 *
 * Offline on purpose: sending a hash prefix to an online breach API would leak
 * that a PRAHARI deployment exists and is setting a password right now, and
 * INV-12 forbids a paid dependency anyway.
 *
 * `data/common-passwords.txt` is one password per line and NOTHING ELSE -- no
 * header, no comments, no escaping. There is deliberately no parser: a data
 * file with a syntax is a data file that can be got wrong, and the failure mode
 * (a comment line silently treated as a forbidden password) would be invisible.
 * The list is the head of the credential-stuffing distribution, not a full
 * top-100k; `docs/METRICS.md` records how to regenerate it from a public corpus
 * for a deployment that wants the whole thing.
 */
function loadBreachList(): Set<string> {
  if (breached) return breached;
  try {
    const raw = readFileSync(join(process.cwd(), "data", "common-passwords.txt"), "utf8");
    breached = new Set(
      raw
        .split("\n")
        .map((l) => l.trim().toLowerCase())
        .filter(Boolean)
    );
  } catch {
    // A missing list must not block a password reset. It is defence in depth,
    // not the only defence -- and failing closed here would mean a corrupted
    // file locks every user out of their own account.
    breached = new Set();
  }
  return breached;
}

export function isBreached(plain: string): boolean {
  return loadBreachList().has(plain.trim().toLowerCase());
}

export function resetBreachList(): void {
  breached = null;
}

// ---------------------------------------------------------------------------
// The policy
// ---------------------------------------------------------------------------

export interface PolicyResult {
  ok: boolean;
  /** Every failure, so the user fixes them in one pass rather than five. */
  problems: string[];
}

/**
 * Enforced on SET and RESET only.
 *
 * Never on login: an existing password that no longer meets policy must still
 * let its owner in, so they can change it. Rejecting it at the door locks out
 * exactly the people the policy is trying to help.
 */
export function checkPolicy(plain: string, context: { email?: string; name?: string } = {}): PolicyResult {
  const problems: string[] = [];
  const p = plain ?? "";

  if (p.length < MIN_PASSWORD_LENGTH) {
    problems.push(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (p.length > 200) {
    // Not a strength rule: bcrypt truncates at 72 bytes and a megabyte-long
    // password is a CPU-exhaustion vector, not a stronger secret.
    problems.push("Use at most 200 characters.");
  }
  if (isBreached(p)) {
    problems.push("That password appears in public breach lists. Choose another.");
  }
  const local = context.email?.split("@")[0]?.toLowerCase();
  if (local && local.length > 2 && p.toLowerCase().includes(local)) {
    problems.push("Do not include your email address.");
  }
  if (context.name && context.name.length > 2 && p.toLowerCase().includes(context.name.toLowerCase())) {
    problems.push("Do not include your name.");
  }
  if (/^(.)\1+$/.test(p)) {
    problems.push("Do not use a single repeated character.");
  }

  return { ok: problems.length === 0, problems };
}

/**
 * A stable, non-reversible fingerprint of a password, for the ledger.
 *
 * The audit chain records that a password CHANGED without recording what to.
 * Even a hash would be a cracking target sitting in an append-only log that is
 * exported to third parties; a truncated HMAC over the pepper is enough to show
 * two entries differ and useless for anything else.
 */
export function changeFingerprint(hash: string): string {
  return createHash("sha256").update(`${pepper()}:${hash}`).digest("hex").slice(0, 16);
}
