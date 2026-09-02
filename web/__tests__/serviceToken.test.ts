/**
 * The service token (DEC-060).
 *
 * The web layer mints it; the ENGINE verifies it, in Python. These tests pin
 * the wire format and the binding property from this side, and
 * `engine/tests/test_admin_auth.py` pins the same things from the other — so
 * the two implementations cannot drift without one of them going red.
 */
import { describe, it, expect } from "vitest";
import { SERVICE_TOKEN_TTL_SECONDS, serviceToken, verifyServiceToken } from "@/lib/serviceToken";

const SECRET = "shared-test-secret";
const AT = Date.parse("2026-09-03T10:00:00Z");
const claims = {
  sub: "usr_1",
  email: "a@prahari.local",
  role: "admin",
  path: "users",
  method: "GET",
};

const mint = (over: Partial<typeof claims> = {}, at = AT) =>
  serviceToken({ ...claims, ...over }, at, SECRET);

const decode = (token: string) =>
  JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));

describe("wire format", () => {
  it("is two base64url segments joined by a dot", () => {
    const parts = mint().split(".");
    expect(parts).toHaveLength(2);
    for (const p of parts) expect(p).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("carries the claims the engine reads, and an expiry", () => {
    const decoded = decode(mint());
    expect(decoded).toMatchObject({ sub: "usr_1", email: "a@prahari.local", role: "admin" });
    expect(decoded.exp - decoded.iat).toBe(SERVICE_TOKEN_TTL_SECONDS);
  });

  it("lives sixty seconds: long enough to cross one hop, not to be stored", () => {
    expect(SERVICE_TOKEN_TTL_SECONDS).toBe(60);
  });

  it("normalises the path, so a stray slash cannot invalidate a good token", () => {
    expect(decode(mint({ path: "/users/" })).path).toBe("users");
  });

  it("upper-cases the method", () => {
    expect(decode(mint({ method: "patch" })).method).toBe("PATCH");
  });
});

describe("verification", () => {
  it("accepts its own token for the same request", () => {
    expect(verifyServiceToken(mint(), { path: "users", method: "GET" }, AT, SECRET).ok).toBe(true);
  });

  it("refuses a token signed with a different secret", () => {
    expect(verifyServiceToken(mint(), { path: "users", method: "GET" }, AT, "other")).toEqual({
      ok: false,
      reason: "bad-signature",
    });
  });

  it("refuses a tampered payload", () => {
    // Escalating the role in the body must invalidate the signature.
    const original = mint({ role: "viewer" });
    const decoded = decode(original);
    decoded.role = "admin";
    const forged = Buffer.from(JSON.stringify(decoded)).toString("base64url");
    const mac = original.split(".")[1];
    expect(
      verifyServiceToken(`${forged}.${mac}`, { path: "users", method: "GET" }, AT, SECRET).ok
    ).toBe(false);
  });

  it("refuses an expired token", () => {
    const r = verifyServiceToken(
      mint(),
      { path: "users", method: "GET" },
      AT + (SERVICE_TOKEN_TTL_SECONDS + 1) * 1000,
      SECRET
    );
    expect(r).toEqual({ ok: false, reason: "expired" });
  });

  /**
   * THE BINDING PROPERTY.
   *
   * Without it, a token captured from any admin read would be a general-purpose
   * admin credential for its whole lifetime.
   */
  it("refuses a token minted for a different path", () => {
    expect(
      verifyServiceToken(mint(), { path: "retention/purge", method: "GET" }, AT, SECRET)
    ).toEqual({ ok: false, reason: "wrong-request" });
  });

  it("refuses a token minted for a different method", () => {
    expect(verifyServiceToken(mint(), { path: "users", method: "DELETE" }, AT, SECRET)).toEqual({
      ok: false,
      reason: "wrong-request",
    });
  });

  it.each(["", "no-dot", "a.b.c", "!!!.???", "."])("refuses the malformed token %s", (bad) => {
    expect(verifyServiceToken(bad, { path: "users", method: "GET" }, AT, SECRET).ok).toBe(false);
  });

  it("does not throw on any malformed input", () => {
    for (const bad of ["", "x", "x.y", "..", " . "]) {
      expect(() =>
        verifyServiceToken(bad, { path: "users", method: "GET" }, AT, SECRET)
      ).not.toThrow();
    }
  });
});

describe("the engine mirrors this implementation", () => {
  it("uses the same algorithm and the same claim names", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const py = readFileSync(
      join(process.cwd(), "..", "engine", "engine", "admin", "auth.py"),
      "utf8"
    );
    expect(py).toContain("hashlib.sha256");
    expect(py).toContain("hmac.compare_digest");
    for (const claim of ["sub", "email", "role", "path", "method", "exp"]) {
      expect(py, claim).toContain(`"${claim}"`);
    }
    // The binding check must exist on the engine side too, or the property is
    // enforced only by the layer that is not the trust boundary.
    expect(py).toContain("not for this request");
  });
});
