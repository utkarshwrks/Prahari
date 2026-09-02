/**
 * Session hardening, CSRF, credentials and the IP allowlist (DEC-058, DEC-059).
 *
 * These are the controls that make the Command Panel's existence defensible.
 * The gate items they own: CSRF rejection, session revocation, last-admin
 * protection, self-role-change refusal, and the fail-closed direction of every
 * one of them.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ABSOLUTE_SESSION_SECONDS, JWT_TTL_SECONDS, check, cookieOptions, csrfToken, listFor,
  newSessionId, register, resetSessions, revoke, revokeAllFor, verifyCsrf,
} from "@/lib/sessions";
import {
  BCRYPT_COST, MIN_PASSWORD_LENGTH, changeFingerprint, checkPolicy, costOf, hashPassword,
  isBreached, resetBreachList, verifyPassword,
} from "@/lib/passwords";
import { clientIp, ipAllowed, matches, parseAllowlist, parseRule } from "@/lib/ipAllowlist";
import { LIMITS, limitFor, needsLedgerEntry } from "@/lib/adminGuard";

const SECRET = "test-secret";
const AT = Date.parse("2026-09-03T09:00:00Z");

const seed = (over: Partial<Parameters<typeof register>[0]> = {}) =>
  register(
    {
      id: over.id ?? newSessionId(),
      userId: over.userId ?? "usr_1",
      email: over.email ?? "a@prahari.local",
      role: over.role ?? "officer",
      userAgent: "test",
      ip: "10.0.0.1",
    },
    AT
  );

beforeEach(() => {
  resetSessions();
  resetBreachList();
});

describe("session registry", () => {
  it("accepts a freshly registered session", () => {
    const s = seed();
    expect(check(s.id, AT).valid).toBe(true);
  });

  /**
   * The fail-closed direction. A process restart drops the registry, and the
   * alternative -- trusting any well-signed token whose session we have no
   * record of -- would make the revocation list decorative.
   */
  it("treats an UNKNOWN session as invalid, not as valid", () => {
    const r = check("never-registered", AT);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("unknown");
  });

  it("rejects a revoked session", () => {
    const s = seed();
    expect(revoke(s.id, "test")).toBe(true);
    const r = check(s.id, AT);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("revoked");
  });

  it("does not revoke the same session twice", () => {
    const s = seed();
    revoke(s.id, "first");
    expect(revoke(s.id, "second")).toBe(false);
    // The first reason stands: an audit trail that overwrote why a session was
    // killed would lose the interesting one.
    expect(listFor("usr_1")[0].revokedReason).toBe("first");
  });

  it("enforces the absolute age cap regardless of activity", () => {
    const s = seed();
    // Activity inside the window refreshes lastSeenAt but not createdAt.
    expect(check(s.id, AT + 60_000).valid).toBe(true);
    const r = check(s.id, AT + (ABSOLUTE_SESSION_SECONDS + 1) * 1000);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("expired");
  });

  it("caps a session at one shift, and rotates the JWT far more often", () => {
    expect(ABSOLUTE_SESSION_SECONDS).toBe(8 * 60 * 60);
    expect(JWT_TTL_SECONDS).toBeLessThan(ABSOLUTE_SESSION_SECONDS);
  });

  it("revokes every session a user holds, on role change or password reset", () => {
    const a = seed({ id: "s-a" });
    const b = seed({ id: "s-b" });
    seed({ id: "s-other", userId: "usr_2" });
    expect(revokeAllFor("usr_1", "role-change")).toBe(2);
    expect(check(a.id, AT).valid).toBe(false);
    expect(check(b.id, AT).valid).toBe(false);
    expect(check("s-other", AT).valid).toBe(true);
  });

  it("lists a user's own sessions, most recent first", () => {
    seed({ id: "s-1" });
    seed({ id: "s-2" });
    check("s-2", AT + 5_000);
    const list = listFor("usr_1");
    expect(list.map((s) => s.id)).toEqual(["s-2", "s-1"]);
  });

  it("never lists another user's sessions", () => {
    seed({ id: "mine" });
    seed({ id: "theirs", userId: "usr_2" });
    expect(listFor("usr_1").map((s) => s.id)).toEqual(["mine"]);
  });

  it("issues unpredictable session ids", () => {
    const ids = new Set(Array.from({ length: 200 }, newSessionId));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id.length).toBeGreaterThanOrEqual(32);
  });
});

describe("cookie attributes", () => {
  it("is httpOnly and SameSite=Lax always", () => {
    const dev = cookieOptions(false);
    expect(dev.httpOnly).toBe(true);
    expect(dev.sameSite).toBe("lax");
  });

  it("sets Secure in production only", () => {
    // Secure on plain http://localhost would make the cookie be dropped, so
    // every local run would silently fail to authenticate.
    expect(cookieOptions(true).secure).toBe(true);
    expect(cookieOptions(false).secure).toBe(false);
  });
});

describe("CSRF", () => {
  it("accepts the token it issued for that session", () => {
    const t = csrfToken("sess-1", SECRET);
    expect(verifyCsrf("sess-1", SECRET, t)).toBe(true);
  });

  it("rejects a missing token", () => {
    expect(verifyCsrf("sess-1", SECRET, null)).toBe(false);
    expect(verifyCsrf("sess-1", SECRET, "")).toBe(false);
  });

  it("rejects another session's token", () => {
    // Binding to the session is what stops a token harvested from one account
    // being replayed against another.
    expect(verifyCsrf("sess-1", SECRET, csrfToken("sess-2", SECRET))).toBe(false);
  });

  it("rejects a token minted under a different secret", () => {
    expect(verifyCsrf("sess-1", SECRET, csrfToken("sess-1", "other-secret"))).toBe(false);
  });

  it("rejects a tampered token without throwing", () => {
    const t = csrfToken("sess-1", SECRET);
    for (const bad of [t.slice(0, -1), `${t}x`, t.toUpperCase(), "..", "null"]) {
      expect(() => verifyCsrf("sess-1", SECRET, bad)).not.toThrow();
      expect(verifyCsrf("sess-1", SECRET, bad)).toBe(false);
    }
  });

  it("is deterministic, so it survives a restart alongside the session", () => {
    expect(csrfToken("sess-1", SECRET)).toBe(csrfToken("sess-1", SECRET));
  });
});

describe("credentials", () => {
  it("hashes at cost 12, up from the previous 10", () => {
    expect(BCRYPT_COST).toBe(12);
  });

  it("produces a hash that records the new cost", async () => {
    const h = await hashPassword("a-long-enough-password");
    expect(costOf(h)).toBe(BCRYPT_COST);
  }, 20_000);

  it("verifies its own hashes", async () => {
    const h = await hashPassword("a-long-enough-password");
    const r = await verifyPassword("a-long-enough-password", h);
    expect(r.ok).toBe(true);
    expect(r.needsRehash).toBe(false);
  }, 20_000);

  it("rejects the wrong password", async () => {
    const h = await hashPassword("a-long-enough-password");
    expect((await verifyPassword("wrong", h)).ok).toBe(false);
  }, 20_000);

  /**
   * The prime directive, applied to credentials: every account created before
   * the pepper existed must still be able to log in.
   */
  it("accepts a legacy un-peppered hash and flags it for re-hashing", async () => {
    const bcrypt = (await import("bcryptjs")).default;
    const legacy = bcrypt.hashSync("legacy-password", 10);
    const r = await verifyPassword("legacy-password", legacy);
    expect(r.ok).toBe(true);
    expect(r.needsRehash).toBe(true);
  }, 20_000);

  it("reads the cost from a hash, and 0 from junk", () => {
    expect(costOf("$2a$10$abcdefghijklmnopqrstuv")).toBe(10);
    expect(costOf("$2b$12$abcdefghijklmnopqrstuv")).toBe(12);
    expect(costOf("not-a-hash")).toBe(0);
  });
});

describe("password policy", () => {
  it("requires twelve characters", () => {
    expect(checkPolicy("short").problems).toContain(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
    expect(checkPolicy("twelve-chars").ok).toBe(true);
  });

  it("rejects a breached password even when it is long enough", () => {
    expect(isBreached("Password123")).toBe(true);
    expect(checkPolicy("Password123").ok).toBe(false);
  });

  it("is case-insensitive about the breach list", () => {
    expect(isBreached("PASSWORD")).toBe(true);
    expect(isBreached("PaSsWoRd")).toBe(true);
  });

  it("rejects a password containing the user's own email local part", () => {
    const r = checkPolicy("nightowl1-is-me", { email: "nightowl1@prahari.local" });
    expect(r.ok).toBe(false);
    expect(r.problems.join(" ")).toMatch(/email/i);
  });

  it("rejects a password containing the user's name", () => {
    expect(checkPolicy("utkarsh-the-great", { name: "Utkarsh" }).ok).toBe(false);
  });

  it("rejects a single repeated character", () => {
    expect(checkPolicy("aaaaaaaaaaaaaaaa").ok).toBe(false);
  });

  it("caps length, because bcrypt truncates and a huge input is a CPU cost", () => {
    expect(checkPolicy("x".repeat(500)).problems.join(" ")).toMatch(/at most 200/);
  });

  it("reports every problem at once", () => {
    // Fixing one rule at a time across five submissions is how people end up
    // choosing Password1!.
    const r = checkPolicy("admin", { email: "admin@prahari.local" });
    expect(r.problems.length).toBeGreaterThanOrEqual(2);
  });

  it("has no composition theatre: a long passphrase passes with no symbols", () => {
    expect(checkPolicy("correct horse battery staple").ok).toBe(true);
  });

  it("survives a missing breach list rather than blocking every reset", () => {
    // Failing closed here would mean a corrupted data file locks every user out
    // of their own account. It is defence in depth, not the only defence.
    expect(() => isBreached("anything")).not.toThrow();
  });
});

describe("password change fingerprint", () => {
  it("differs for different hashes and is stable for the same one", () => {
    const a = changeFingerprint("$2b$12$aaa");
    expect(changeFingerprint("$2b$12$aaa")).toBe(a);
    expect(changeFingerprint("$2b$12$bbb")).not.toBe(a);
  });

  it("is short and non-reversible, so the ledger carries no cracking target", () => {
    const f = changeFingerprint("$2b$12$aaa");
    expect(f).toMatch(/^[0-9a-f]{16}$/);
    expect(f).not.toContain("$2b$");
  });
});

describe("IP allowlist", () => {
  const hdr = (ip?: string) => new Headers(ip ? { "x-forwarded-for": ip } : {});

  it("is OFF by default: an unset variable allows everything", () => {
    expect(ipAllowed(hdr("203.0.113.9"), undefined)).toBe(true);
    expect(ipAllowed(hdr("203.0.113.9"), "")).toBe(true);
  });

  it("allows an address inside a configured CIDR", () => {
    expect(ipAllowed(hdr("10.0.5.7"), "10.0.0.0/16")).toBe(true);
  });

  it("refuses an address outside every range", () => {
    expect(ipAllowed(hdr("203.0.113.9"), "10.0.0.0/16,192.168.0.0/24")).toBe(false);
  });

  it("REFUSES when the allowlist is set but the caller cannot be identified", () => {
    // "We could not tell who this is" is not a reason to admit someone to an
    // admin panel.
    expect(ipAllowed(hdr(), "10.0.0.0/16")).toBe(false);
  });

  it("handles a bare address as a /32", () => {
    expect(ipAllowed(hdr("10.0.0.1"), "10.0.0.1")).toBe(true);
    expect(ipAllowed(hdr("10.0.0.2"), "10.0.0.1")).toBe(false);
  });

  it("treats /0 as allow-all, and says so by matching anything", () => {
    expect(matches(parseAllowlist("0.0.0.0/0"), "203.0.113.9")).toBe(true);
  });

  it("falls back to an exact match for an IPv6 literal rather than dropping the rule", () => {
    // Silently dropping an unparseable rule would WIDEN the allowlist, which is
    // the wrong direction for a security control to fail in.
    const rules = parseAllowlist("::1,10.0.0.0/8");
    expect(rules).toHaveLength(2);
    expect(matches(rules, "::1")).toBe(true);
    expect(matches(rules, "::2")).toBe(false);
  });

  it("rejects a malformed mask instead of guessing one", () => {
    expect(parseRule("10.0.0.0/99")).toBeNull();
    expect(parseRule("10.0.0.0/-1")).toBeNull();
  });

  it("ignores whitespace around entries", () => {
    expect(ipAllowed(hdr("10.0.0.1"), " 10.0.0.0/8 , 192.168.1.1 ")).toBe(true);
  });

  it("takes the first x-forwarded-for hop, then x-real-ip", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIp(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers({}))).toBe("");
  });
});

describe("per-surface rate limits (DEC-046 keyed to what is worth protecting)", () => {
  it("keys TOTP verification to the ACCOUNT, not the IP", () => {
    // A distributed attack from many addresses against one account must still
    // be throttled; the account is the thing worth protecting.
    expect(LIMITS["totp-verify"].key).toBe("account");
    expect(LIMITS["totp-verify"].limit).toBe(5);
  });

  it("keys role changes and bulk mutations to the ACTING ADMIN", () => {
    // Here the risk is one authorised person doing something sweeping, by
    // mistake or under duress. An IP key would not slow that down at all.
    expect(LIMITS["role-change"].key).toBe("admin");
    expect(LIMITS["bulk-mutation"].key).toBe("admin");
    expect(LIMITS["bulk-mutation"].limit).toBe(3);
  });

  it("matches each guarded surface to its limit", () => {
    expect(limitFor("stepup/verify", "POST")).toBe("totp-verify");
    expect(limitFor("users/usr_1", "PATCH")).toBe("role-change");
    expect(limitFor("bulk/import", "POST")).toBe("bulk-mutation");
    expect(limitFor("retention/purge", "POST")).toBe("bulk-mutation");
    expect(limitFor("reports/case", "GET")).toBe("export");
  });

  it("leaves ordinary reads unlimited", () => {
    expect(limitFor("personas", "GET")).toBeNull();
  });
});

describe("ledger coverage", () => {
  it("requires a ledger entry for every mutating method, and none for reads", () => {
    for (const m of ["POST", "PATCH", "PUT", "DELETE", "post", "patch"]) {
      expect(needsLedgerEntry(m), m).toBe(true);
    }
    for (const m of ["GET", "HEAD", "OPTIONS", "get"]) {
      expect(needsLedgerEntry(m), m).toBe(false);
    }
  });
});
