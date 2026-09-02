/**
 * Auth constants and RBAC (`lib/authConfig.ts`).
 *
 * INV-8 lives here: production refuses to boot without a real NEXTAUTH_SECRET,
 * and refuses the committed dev default separately -- while the BUILD phase
 * stays exempt (DEC-051), because `next build` runs with NODE_ENV=production
 * and a build authenticates nobody. That exemption is narrow and easy to widen
 * by accident, so it is asserted from both sides.
 *
 * The module resolves its secret at import time, so each case re-imports with a
 * fresh module registry rather than trying to mutate a frozen constant.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { can, ROLE_PERMISSIONS, type Role } from "@/lib/authConfig";

const DEV_SECRET = "prahari-local-development-secret-do-not-use-in-production-8f3a";

const ENV = { ...process.env };
beforeEach(() => vi.resetModules());
afterEach(() => {
  process.env = { ...ENV };
});

/** Import the module fresh under a given environment. */
async function load(env: Record<string, string | undefined>) {
  process.env = { ...ENV, ...env } as NodeJS.ProcessEnv;
  return import("@/lib/authConfig");
}

describe("INV-8 - the production secret guard", () => {
  it("accepts a real secret in production", async () => {
    const m = await load({ NODE_ENV: "production", NEXTAUTH_SECRET: "a-real-32-byte-secret-value" });
    expect(m.AUTH_SECRET).toBe("a-real-32-byte-secret-value");
  });

  it("refuses to boot in production with no secret", async () => {
    await expect(
      load({ NODE_ENV: "production", NEXTAUTH_SECRET: undefined, NEXT_PHASE: undefined })
    ).rejects.toThrow(/refuses to start in production without NEXTAUTH_SECRET/);
  });

  it("refuses the committed dev default in production, separately", async () => {
    // A distinct check: a deployment that copied .env.local.example would
    // otherwise pass the "is it set" test with a publicly known secret.
    await expect(
      load({ NODE_ENV: "production", NEXTAUTH_SECRET: DEV_SECRET, NEXT_PHASE: undefined })
    ).rejects.toThrow(/set to the development default/);
  });

  it("exempts the build phase when the secret is missing (DEC-051)", async () => {
    const m = await load({
      NODE_ENV: "production",
      NEXTAUTH_SECRET: undefined,
      NEXT_PHASE: "phase-production-build",
    });
    expect(m.AUTH_SECRET).toBe(DEV_SECRET);
  });

  it("exempts the build phase when the secret is the dev default (DEC-051)", async () => {
    const m = await load({
      NODE_ENV: "production",
      NEXTAUTH_SECRET: DEV_SECRET,
      NEXT_PHASE: "phase-production-build",
    });
    expect(m.AUTH_SECRET).toBe(DEV_SECRET);
  });

  it("the exemption is the build phase only, not any NEXT_PHASE value", async () => {
    await expect(
      load({ NODE_ENV: "production", NEXTAUTH_SECRET: undefined, NEXT_PHASE: "phase-export" })
    ).rejects.toThrow(/refuses to start/);
  });

  it("falls back to the dev secret outside production, so a clone runs", async () => {
    const m = await load({ NODE_ENV: "development", NEXTAUTH_SECRET: undefined });
    expect(m.AUTH_SECRET).toBe(DEV_SECRET);
  });

  it("trims a whitespace-only secret rather than accepting it", async () => {
    await expect(
      load({ NODE_ENV: "production", NEXTAUTH_SECRET: "   ", NEXT_PHASE: undefined })
    ).rejects.toThrow(/refuses to start/);
  });
});

describe("the demo account", () => {
  it("is enabled outside production", async () => {
    const m = await load({ NODE_ENV: "development" });
    expect(m.DEMO_ACCOUNT_ENABLED).toBe(true);
  });

  it("is disabled in production by default", async () => {
    // Its password is printed on the login page and committed to this repo.
    const m = await load({
      NODE_ENV: "production",
      NEXTAUTH_SECRET: "real",
      ENABLE_DEMO_ACCOUNT: undefined,
    });
    expect(m.DEMO_ACCOUNT_ENABLED).toBe(false);
  });

  it("can be opted back in for a deliberate demo deployment", async () => {
    const m = await load({
      NODE_ENV: "production",
      NEXTAUTH_SECRET: "real",
      ENABLE_DEMO_ACCOUNT: "1",
    });
    expect(m.DEMO_ACCOUNT_ENABLED).toBe(true);
  });

  it("only the exact opt-in value enables it", async () => {
    const m = await load({
      NODE_ENV: "production",
      NEXTAUTH_SECRET: "real",
      ENABLE_DEMO_ACCOUNT: "true",
    });
    expect(m.DEMO_ACCOUNT_ENABLED).toBe(false);
  });
});

describe("RBAC", () => {
  it("officer may seal and export; analyst may not", () => {
    expect(can("officer", "seal")).toBe(true);
    expect(can("officer", "export")).toBe(true);
    expect(can("analyst", "seal")).toBe(false);
    expect(can("analyst", "export")).toBe(false);
  });

  it("both roles may read, investigate and verify", () => {
    for (const role of ["officer", "analyst"] as Role[]) {
      for (const p of ["read", "investigate", "verify"]) {
        expect(can(role, p)).toBe(true);
      }
    }
  });

  it("denies an unknown role", () => {
    expect(can("supervisor", "read")).toBe(false);
    expect(can("admin", "read")).toBe(false);
  });

  it("denies a missing role rather than defaulting to a permission", () => {
    expect(can(undefined, "read")).toBe(false);
    expect(can("", "read")).toBe(false);
  });

  it("denies an unknown permission for a known role", () => {
    expect(can("officer", "manage:users")).toBe(false);
  });

  it("analyst permissions are a strict subset of officer permissions", () => {
    // Phase 4 extends this hierarchy with supervisor and admin. The subset
    // property is what makes that extension safe.
    const officer = new Set(ROLE_PERMISSIONS.officer);
    expect(ROLE_PERMISSIONS.analyst.every((p) => officer.has(p))).toBe(true);
  });
});
