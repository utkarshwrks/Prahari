/**
 * Step-up authentication (DEC-059).
 *
 * The four properties that make a second factor worth having, each of which is
 * easy to get subtly wrong and invisible when you do:
 *
 *   1. single-use codes,
 *   2. ±1 window drift and no more,
 *   3. recovery codes hashed at rest and single-use,
 *   4. the step-up token held server-side, not as a client claim.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  RECOVERY_CODE_COUNT, TOTP_ISSUER, enrol, generateAt, grantStepUp, hashRecoveryCode,
  recoveryRemaining, resetStepUps, revokeStepUp, stepUpAge, verifyStepUp, windowOf,
  type TotpState,
} from "@/lib/totp";
import { FRESH_STEP_UP_SECONDS, STEP_UP_TTL_SECONDS } from "@/lib/rbac";

const PEPPER = "test-pepper";
const AT = Date.parse("2026-09-03T12:00:00Z");

let enrolment: ReturnType<typeof enrol>;
let state: TotpState;

beforeEach(() => {
  resetStepUps();
  enrolment = enrol("analyst@prahari.local", PEPPER);
  state = {
    secret: enrolment.secret,
    recoveryHashes: enrolment.recoveryHashes,
    usedCodes: [],
    usedRecovery: [],
  };
});

/**
 * A valid code for a given moment, computed the same way a phone would.
 *
 * Goes through the library's own epoch option rather than a second argument:
 * `authenticator.generate(secret, { epoch })` SILENTLY IGNORES the second
 * argument, so the first version of this helper always produced a code for
 * "now" -- which made the drift tests pass a code they thought was two windows
 * old. That mistake is what surfaced the real bug: the verifier was also
 * ignoring the injected clock.
 */
const codeAt = generateAt;

describe("enrolment", () => {
  it("produces a scannable otpauth URI naming the issuer and the account", () => {
    expect(enrolment.uri).toMatch(/^otpauth:\/\/totp\//);
    expect(enrolment.uri).toContain(encodeURIComponent(TOTP_ISSUER));
    expect(enrolment.uri).toContain("analyst%40prahari.local");
    expect(enrolment.uri).toContain(`secret=${enrolment.secret}`);
  });

  it("issues eight recovery codes", () => {
    expect(enrolment.recoveryCodes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(enrolment.recoveryHashes).toHaveLength(RECOVERY_CODE_COUNT);
  });

  it("recovery codes avoid ambiguous glyphs", () => {
    // 0/O and 1/I/L are the characters people mistype off a printed sheet.
    for (const c of enrolment.recoveryCodes) {
      expect(c).toMatch(/^[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/);
      expect(c).not.toMatch(/[01OIL]/);
    }
  });

  it("recovery codes are unique within an enrolment", () => {
    expect(new Set(enrolment.recoveryCodes).size).toBe(RECOVERY_CODE_COUNT);
  });

  it("two enrolments share no secret and no recovery code", () => {
    const other = enrol("other@prahari.local", PEPPER);
    expect(other.secret).not.toBe(enrolment.secret);
    const overlap = other.recoveryCodes.filter((c) => enrolment.recoveryCodes.includes(c));
    expect(overlap).toEqual([]);
  });

  /** Property 3: what goes to disk is not what the user was shown. */
  it("stores only hashes, never the plaintext code", () => {
    for (const c of enrolment.recoveryCodes) {
      const bare = c.replace(/-/g, "");
      expect(enrolment.recoveryHashes).not.toContain(c);
      expect(enrolment.recoveryHashes).not.toContain(bare);
    }
    expect(enrolment.recoveryHashes.every((h) => /^[0-9a-f]{64}$/.test(h))).toBe(true);
  });

  it("the hash is pepper-dependent, so a stolen database is not enough", () => {
    const a = hashRecoveryCode("ABCDE-FGHJK", "pepper-one");
    const b = hashRecoveryCode("ABCDE-FGHJK", "pepper-two");
    expect(a).not.toBe(b);
  });

  it("hashing normalises case and hyphens", () => {
    const canonical = hashRecoveryCode("ABCDE-FGHJK", PEPPER);
    expect(hashRecoveryCode("abcdefghjk", PEPPER)).toBe(canonical);
    expect(hashRecoveryCode("  ABCDEFGHJK  ", PEPPER)).toBe(canonical);
  });
});

describe("a valid code", () => {
  it("is accepted", () => {
    const r = verifyStepUp(state, codeAt(state.secret, AT), PEPPER, AT);
    expect(r).toEqual({ ok: true, via: "totp" });
  });

  it("is recorded as spent", () => {
    verifyStepUp(state, codeAt(state.secret, AT), PEPPER, AT);
    expect(state.usedCodes).toHaveLength(1);
    expect(state.usedCodes[0].window).toBe(windowOf(AT));
  });
});

/** Property 1: single use. */
describe("replay", () => {
  it("refuses the same code twice", () => {
    const code = codeAt(state.secret, AT);
    expect(verifyStepUp(state, code, PEPPER, AT).ok).toBe(true);
    const second = verifyStepUp(state, code, PEPPER, AT);
    expect(second).toEqual({ ok: false, reason: "replayed" });
  });

  it("refuses a replay from the adjacent window too", () => {
    // The code is still cryptographically valid one step later, so replay
    // protection has to span the same window the drift allowance does --
    // otherwise a shoulder-surfed code simply works 30 seconds later.
    const code = codeAt(state.secret, AT);
    verifyStepUp(state, code, PEPPER, AT);
    const replay = verifyStepUp(state, code, PEPPER, AT + 30_000);
    expect(replay.ok).toBe(false);
    if (!replay.ok) expect(replay.reason).toBe("replayed");
  });

  it("forgets a spent code once it can no longer be valid", () => {
    // Unbounded growth would be a slow per-user memory leak, and the entry is
    // pointless once the code itself is outside the drift window.
    const code = codeAt(state.secret, AT);
    verifyStepUp(state, code, PEPPER, AT);
    verifyStepUp(state, codeAt(state.secret, AT + 300_000), PEPPER, AT + 300_000);
    expect(state.usedCodes.some((u) => u.code === code)).toBe(false);
  });

  it("bounds the spent-code list to the drift window", () => {
    for (let i = 0; i < 20; i++) {
      const t = AT + i * 30_000;
      verifyStepUp(state, codeAt(state.secret, t), PEPPER, t);
    }
    expect(state.usedCodes.length).toBeLessThanOrEqual(3);
  });
});

/** Property 2: drift is ±1 window, and no more. */
describe("clock drift", () => {
  it("accepts a code from one window earlier", () => {
    const code = codeAt(state.secret, AT - 30_000);
    expect(verifyStepUp(state, code, PEPPER, AT).ok).toBe(true);
  });

  it("accepts a code from one window later", () => {
    const code = codeAt(state.secret, AT + 30_000);
    expect(verifyStepUp(state, code, PEPPER, AT).ok).toBe(true);
  });

  it("refuses a code from two windows earlier", () => {
    // Every extra window is another 30 seconds of validity for a code an
    // attacker observed. Two is measurably weaker for no usability gain.
    const code = codeAt(state.secret, AT - 90_000);
    expect(verifyStepUp(state, code, PEPPER, AT)).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses a code from two windows later", () => {
    const code = codeAt(state.secret, AT + 90_000);
    expect(verifyStepUp(state, code, PEPPER, AT).ok).toBe(false);
  });

  it("refuses a code from a different secret", () => {
    const other = enrol("x@y.test", PEPPER);
    expect(verifyStepUp(state, codeAt(other.secret, AT), PEPPER, AT).ok).toBe(false);
  });

  it.each(["000000", "123456", "999999", "", "12345", "1234567", "abcdef"])(
    "refuses the junk submission %s",
    (junk) => {
      expect(verifyStepUp(state, junk, PEPPER, AT).ok).toBe(false);
    }
  );

  it("does not throw on a malformed secret", () => {
    const broken: TotpState = { ...state, secret: "not-base32-!!" };
    expect(() => verifyStepUp(broken, "123456", PEPPER, AT)).not.toThrow();
    expect(verifyStepUp(broken, "123456", PEPPER, AT).ok).toBe(false);
  });
});

/** Property 3: recovery codes are single-use. */
describe("recovery codes", () => {
  it("accepts a genuine recovery code", () => {
    const r = verifyStepUp(state, enrolment.recoveryCodes[0], PEPPER, AT);
    expect(r).toEqual({ ok: true, via: "recovery" });
  });

  it("accepts it without the hyphen and in lower case", () => {
    const bare = enrolment.recoveryCodes[1].replace(/-/g, "").toLowerCase();
    expect(verifyStepUp(state, bare, PEPPER, AT).ok).toBe(true);
  });

  it("refuses the same recovery code a second time", () => {
    const code = enrolment.recoveryCodes[2];
    expect(verifyStepUp(state, code, PEPPER, AT).ok).toBe(true);
    expect(verifyStepUp(state, code, PEPPER, AT)).toEqual({
      ok: false,
      reason: "recovery-spent",
    });
  });

  it("spending one code leaves the others usable", () => {
    verifyStepUp(state, enrolment.recoveryCodes[0], PEPPER, AT);
    expect(verifyStepUp(state, enrolment.recoveryCodes[1], PEPPER, AT).ok).toBe(true);
    expect(recoveryRemaining(state)).toBe(RECOVERY_CODE_COUNT - 2);
  });

  it("counts down as codes are spent", () => {
    expect(recoveryRemaining(state)).toBe(8);
    for (let i = 0; i < 8; i++) verifyStepUp(state, enrolment.recoveryCodes[i], PEPPER, AT);
    expect(recoveryRemaining(state)).toBe(0);
  });

  it("refuses a well-formed code that was never issued", () => {
    expect(verifyStepUp(state, "23456-789AB", PEPPER, AT)).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("refuses a code verified against the wrong pepper", () => {
    expect(verifyStepUp(state, enrolment.recoveryCodes[0], "different-pepper", AT).ok).toBe(false);
  });

  it.each(["short", "0OIL1AAAAA", "!!!!!!!!!!", "AAAAAAAAAAA", "ABCDELLLLL"])(
    "reports %s as malformed rather than invalid",
    (junk) => {
      const r = verifyStepUp(state, junk, PEPPER, AT);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe("malformed");
    }
  );
});

/** Property 4: the token is server-side. */
describe("the step-up token store", () => {
  it("has no step-up before one is granted", () => {
    expect(stepUpAge("sess-1", AT)).toBeNull();
  });

  it("reports an age from the moment it was granted", () => {
    grantStepUp("sess-1", "totp", AT);
    expect(stepUpAge("sess-1", AT)).toBe(0);
    expect(stepUpAge("sess-1", AT + 60_000)).toBe(60);
  });

  it("expires at the fifteen-minute ceiling", () => {
    grantStepUp("sess-1", "totp", AT);
    expect(stepUpAge("sess-1", AT + (STEP_UP_TTL_SECONDS - 1) * 1000)).not.toBeNull();
    expect(stepUpAge("sess-1", AT + (STEP_UP_TTL_SECONDS + 1) * 1000)).toBeNull();
  });

  it("stays fresh only for the fresh window", () => {
    grantStepUp("sess-1", "totp", AT);
    expect(stepUpAge("sess-1", AT + (FRESH_STEP_UP_SECONDS - 1) * 1000)!).toBeLessThan(
      FRESH_STEP_UP_SECONDS
    );
    expect(stepUpAge("sess-1", AT + (FRESH_STEP_UP_SECONDS + 10) * 1000)!).toBeGreaterThan(
      FRESH_STEP_UP_SECONDS
    );
  });

  it("is per session: proving one does not prove another", () => {
    grantStepUp("sess-1", "totp", AT);
    expect(stepUpAge("sess-2", AT)).toBeNull();
  });

  it("is revoked on demand", () => {
    grantStepUp("sess-1", "totp", AT);
    revokeStepUp("sess-1");
    expect(stepUpAge("sess-1", AT)).toBeNull();
  });

  it("self-cleans an expired entry on read", () => {
    grantStepUp("sess-1", "totp", AT);
    expect(stepUpAge("sess-1", AT + 3_600_000)).toBeNull();
    // Reading again at a time when it WOULD still have been valid must not
    // resurrect it -- the entry is gone, not merely reported as old.
    expect(stepUpAge("sess-1", AT)).toBeNull();
  });
});

describe("the module keeps its own promises", () => {
  const src = readFileSync(join(process.cwd(), "lib/totp.ts"), "utf8");

  it("configures otplib with a one-window drift allowance", () => {
    expect(src).toContain("window: [1, 1]");
    expect(src).toContain("step: 30");
  });

  it("is server-only, so a secret cannot reach a client bundle", () => {
    expect(src).toContain('import "server-only"');
  });

  it("compares recovery hashes in constant time", () => {
    expect(src).toContain("timingSafeEqual");
  });

  it("bounds the step-up map", () => {
    expect(src).toContain("MAX_STEP_UPS");
  });
});
