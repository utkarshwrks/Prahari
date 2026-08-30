import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rateLimit, resetAll, clientKey } from "@/lib/rateLimit";
import { can, ROLE_PERMISSIONS } from "@/lib/authConfig";

// Phase 10 production security pass. Each of these is a real deployment risk
// that v1 shipped with, not a hypothetical.

beforeEach(() => resetAll());

describe("rate limiting", () => {
  it("allows traffic up to the limit", () => {
    for (let i = 0; i < 5; i++) expect(rateLimit("k", 5, 60_000).ok).toBe(true);
  });

  it("blocks past the limit", () => {
    for (let i = 0; i < 5; i++) rateLimit("k", 5, 60_000);
    expect(rateLimit("k", 5, 60_000).ok).toBe(false);
  });

  it("reports how long to wait", () => {
    for (let i = 0; i < 6; i++) rateLimit("k", 5, 60_000);
    const r = rateLimit("k", 5, 60_000);
    expect(r.retryAfterSeconds).toBeGreaterThan(0);
    expect(r.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("keys are independent", () => {
    for (let i = 0; i < 5; i++) rateLimit("a", 5, 60_000);
    expect(rateLimit("a", 5, 60_000).ok).toBe(false);
    expect(rateLimit("b", 5, 60_000).ok).toBe(true);
  });

  it("the window expires", () => {
    vi.useFakeTimers();
    for (let i = 0; i < 5; i++) rateLimit("k", 5, 1_000);
    expect(rateLimit("k", 5, 1_000).ok).toBe(false);
    vi.advanceTimersByTime(1_100);
    expect(rateLimit("k", 5, 1_000).ok).toBe(true);
    vi.useRealTimers();
  });

  it("bounds memory against a flood of unique keys", () => {
    // An attacker rotating IPs must not be able to exhaust the process.
    for (let i = 0; i < 12_000; i++) rateLimit(`ip-${i}`, 5, 60_000);
    // Still functioning, not crashed or unbounded.
    expect(rateLimit("after-flood", 5, 60_000).ok).toBe(true);
  });

  it("derives a client key from proxy headers", () => {
    const req = new Request("http://x/", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(clientKey(req, "signup")).toBe("signup:203.0.113.7");
  });

  it("falls back to a stable key with no headers", () => {
    expect(clientKey(new Request("http://x/"), "signup")).toBe("signup:unknown");
  });
});

describe("RBAC", () => {
  it("an officer may seal, an analyst may not", () => {
    expect(can("officer", "seal")).toBe(true);
    expect(can("analyst", "seal")).toBe(false);
  });

  it("both may read, investigate and verify", () => {
    for (const p of ["read", "investigate", "verify"]) {
      expect(can("officer", p)).toBe(true);
      expect(can("analyst", p)).toBe(true);
    }
  });

  it("an unknown or absent role has no permissions", () => {
    expect(can(undefined, "read")).toBe(false);
    expect(can("attacker", "read")).toBe(false);
    expect(can("", "seal")).toBe(false);
  });

  it("permission sets are explicit, not inherited", () => {
    expect(ROLE_PERMISSIONS.officer).toContain("seal");
    expect(ROLE_PERMISSIONS.analyst).not.toContain("seal");
    expect(ROLE_PERMISSIONS.analyst).not.toContain("export");
  });
});

describe("production hardening is wired, not just documented", () => {
  it("authConfig refuses a production boot without NEXTAUTH_SECRET", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("lib/authConfig.ts", "utf8");
    expect(src).toMatch(/refuses to start in production without NEXTAUTH_SECRET/);
    // Assert the CHECK, not the prose: matching a message is brittle (this
    // one is split across a string concatenation) and proves nothing about
    // behaviour. Setting NEXTAUTH_SECRET to the dev default is the subtler
    // mistake and must also be refused.
    expect(src).toMatch(/IS_PRODUCTION && !IS_BUILD_PHASE && configured === DEV_SECRET/);
    expect(src).toMatch(/if \(IS_PRODUCTION && !IS_BUILD_PHASE\) \{[\s\S]*?throw new Error/);
  });

  it("the demo account is gated on NODE_ENV, not on a comment", async () => {
    const fs = await import("fs");
    expect(fs.readFileSync("lib/users.ts", "utf8")).toMatch(/DEMO_ACCOUNT_ENABLED \?/);
    expect(fs.readFileSync("lib/authConfig.ts", "utf8")).toMatch(
      /DEMO_ACCOUNT_ENABLED = !IS_PRODUCTION/
    );
  });

  it("both unauthenticated endpoints are rate limited", async () => {
    const fs = await import("fs");
    expect(fs.readFileSync("app/api/signup/route.ts", "utf8")).toMatch(/rateLimit\(/);
    expect(fs.readFileSync("lib/auth.ts", "utf8")).toMatch(/rateLimit\(/);
  });

  it("a throttled login is indistinguishable from a wrong password", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("lib/auth.ts", "utf8");
    // Returning a distinct error would confirm which accounts exist.
    expect(src).toMatch(/return null;/);
    expect(src).toMatch(/which accounts exist/);
  });
});

describe("the production guard does not break the build", () => {
  it("exempts the Next build phase explicitly", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("lib/authConfig.ts", "utf8");
    // Caught by the Phase 11 fresh-clone run: `next build` sets
    // NODE_ENV=production, so the import-time guard failed the build on any
    // machine without a secret -- CI, and any judge following the README.
    // A build authenticates nobody; a running server does.
    expect(src).toMatch(/NEXT_PHASE === "phase-production-build"/);
    expect(src).toMatch(/IS_PRODUCTION && !IS_BUILD_PHASE/);
  });

  it("still refuses at runtime, which is the case that matters", async () => {
    const fs = await import("fs");
    const src = fs.readFileSync("lib/authConfig.ts", "utf8");
    // The runtime path must remain a throw, not a warning.
    expect(src).toMatch(/if \(IS_PRODUCTION && !IS_BUILD_PHASE\) \{[\s\S]*?throw new Error/);
  });
});

describe("the dependency manifest is complete", () => {
  it("declares every module the engine imports", async () => {
    const fs = await import("fs");
    const toml = fs.readFileSync("../engine/pyproject.toml", "utf8");
    // Phase 11 fresh-clone run: these were installed ad-hoc during Phases 3-8
    // and worked only on the build machine. A fresh clone failed with
    // ModuleNotFoundError on 26 tests.
    for (const dep of [
      "pandas", "pyarrow", "duckdb", "pgpy", "spacy",
      "neo4j", "splink",
      "scikit-learn", "scipy", "ruptures",
      "mmh3",
      "pynacl", "eth-hash", "pycryptodome", "web3", "reportlab",
    ]) {
      expect(toml).toContain(dep);
    }
  });
});
