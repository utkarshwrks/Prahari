/**
 * THE AUTHORISATION MATRIX — every role against every admin endpoint.
 *
 * The playbook calls this the single most important test file in the phase, and
 * it is right. A Command Panel is a set of buttons that can destroy evidence;
 * the only thing standing between a `viewer` and a retention purge is this
 * table being correct, and the only thing proving it is correct is a test that
 * walks every cell rather than the ones someone thought to check.
 *
 * The matrix is generated, not hand-listed. A hand-written list of expected
 * 403s drifts the moment a route is added — and drifts SILENTLY, because the
 * new route simply is not in the list. Here, adding a route to `ADMIN_ROUTES`
 * automatically adds five rows (one per role) to this test.
 */
import { describe, it, expect } from "vitest";
import {
  ADMIN_ROUTES, FRESH_STEP_UP_SECONDS, PERMISSIONS, ROLE_ORDER, STEP_UP_TTL_SECONDS,
  atLeast, authorize, hasPermission, isDestructive, isSafeAdminPath, permissionsOf, rankOf,
  routeFor, statusFor, type Role,
} from "@/lib/rbac";

/** Every (role, route) pair. 5 roles x 24 routes = 120 cells. */
const MATRIX = ROLE_ORDER.flatMap((role) => ADMIN_ROUTES.map((route) => ({ role, route })));

describe("the matrix covers everything", () => {
  it("walks every role against every route", () => {
    expect(ROLE_ORDER).toHaveLength(5);
    expect(ADMIN_ROUTES.length).toBeGreaterThanOrEqual(20);
    expect(MATRIX).toHaveLength(ROLE_ORDER.length * ADMIN_ROUTES.length);
  });

  it("no route is listed twice for the same method", () => {
    const seen = ADMIN_ROUTES.map((r) => `${r.method} ${r.path}`);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("every route names a permission that some role actually holds", () => {
    // A route guarded by a permission nobody has is dead code that looks like
    // security.
    for (const r of ADMIN_ROUTES) {
      const holders = ROLE_ORDER.filter((role) => hasPermission(role, r.permission));
      expect(holders.length, `${r.method} ${r.path} (${r.permission})`).toBeGreaterThan(0);
    }
  });

  it("every write requires a step-up, and no read does", () => {
    for (const r of ADMIN_ROUTES) {
      const isWrite = r.method !== "GET";
      expect(r.stepUp, `${r.method} ${r.path}`).toBe(isWrite);
    }
  });

  it("every destructive route is also a step-up route", () => {
    for (const r of ADMIN_ROUTES.filter((x) => x.destructive)) {
      expect(r.stepUp, `${r.method} ${r.path}`).toBe(true);
    }
  });
});

/**
 * THE CELL-BY-CELL ASSERTION.
 *
 * Each cell is decided by the permission table alone, computed independently of
 * `authorize()` — so this compares two derivations rather than checking
 * `authorize` against itself.
 */
describe.each(MATRIX)("$role -> $route.method /admin/$route.path", ({ role, route }) => {
  const shouldPass = PERMISSIONS[role as Role].includes(route.permission);

  it(shouldPass ? "is allowed with a fresh step-up" : "is refused with 403", () => {
    const d = authorize({
      path: route.path,
      method: route.method,
      role,
      stepUpAgeSeconds: 0,
    });
    expect(d.allowed).toBe(shouldPass);
    if (!shouldPass) {
      expect(d.reason).toBe("insufficient-role");
      expect(statusFor(d.reason)).toBe(403);
    }
  });

  it("is refused without a session, whatever the role", () => {
    const d = authorize({ path: route.path, method: route.method, role: undefined, stepUpAgeSeconds: 0 });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("no-session");
    expect(statusFor(d.reason)).toBe(401);
  });

  if (route.stepUp) {
    it("is refused when the holder has no step-up at all", () => {
      const d = authorize({
        path: route.path,
        method: route.method,
        role,
        stepUpAgeSeconds: null,
      });
      expect(d.allowed).toBe(false);
      // Role is still checked first, so a viewer sees insufficient-role rather
      // than being told a step-up would have helped.
      expect(d.reason).toBe(shouldPass ? "step-up-required" : "insufficient-role");
    });
  }
});

describe("the role hierarchy", () => {
  it("is strictly increasing: each role is a superset of the one below", () => {
    for (let i = 1; i < ROLE_ORDER.length; i++) {
      const lower = new Set(PERMISSIONS[ROLE_ORDER[i - 1]]);
      const higher = new Set(PERMISSIONS[ROLE_ORDER[i]]);
      for (const p of lower) {
        expect(higher.has(p), `${ROLE_ORDER[i]} is missing ${p} held by ${ROLE_ORDER[i - 1]}`).toBe(true);
      }
      expect(higher.size).toBeGreaterThan(lower.size);
    }
  });

  it("keeps analyst and officer exactly as they were", () => {
    // The prime directive: extending the hierarchy must not silently grant or
    // remove anything from the two roles that already existed.
    expect(permissionsOf("analyst")).toEqual(["investigate", "read", "verify"]);
    expect(permissionsOf("officer")).toEqual([
      "assign", "export", "investigate", "read", "seal", "verify",
    ]);
  });

  it("gives viewer read and nothing else", () => {
    expect(permissionsOf("viewer")).toEqual(["read"]);
    for (const p of ["investigate", "seal", "export", "manage:users"]) {
      expect(hasPermission("viewer", p), p).toBe(false);
    }
  });

  it("gives only admin the three management permissions", () => {
    for (const p of ["manage:users", "manage:roles", "manage:retention"]) {
      const holders = ROLE_ORDER.filter((r) => hasPermission(r, p));
      expect(holders, p).toEqual(["admin"]);
    }
  });

  it("gives supervisor case and source management, but not user management", () => {
    expect(hasPermission("supervisor", "manage:cases")).toBe(true);
    expect(hasPermission("supervisor", "manage:sources")).toBe(true);
    expect(hasPermission("supervisor", "manage:users")).toBe(false);
    expect(hasPermission("supervisor", "manage:roles")).toBe(false);
  });

  /**
   * The playbook writes admin's capability as `impersonate:none`. Minting a
   * permission whose value is the string "none" would make
   * `hasPermission(role, "impersonate:none")` return TRUE, which is the exact
   * opposite of the intent. The capability does not exist at all.
   */
  it("grants no impersonation capability to any role", () => {
    for (const role of ROLE_ORDER) {
      const bad = PERMISSIONS[role].filter((p) => p.startsWith("impersonate"));
      expect(bad, role).toEqual([]);
    }
  });

  it("ranks roles and answers atLeast correctly", () => {
    expect(rankOf("viewer")).toBe(0);
    expect(rankOf("admin")).toBe(4);
    expect(rankOf("nonsense")).toBe(-1);
    expect(atLeast("supervisor", "officer")).toBe(true);
    expect(atLeast("officer", "supervisor")).toBe(false);
    expect(atLeast(undefined, "viewer")).toBe(false);
  });

  it("denies an unknown or empty role everything", () => {
    for (const role of ["", "root", "superuser", undefined]) {
      expect(permissionsOf(role)).toEqual([]);
      expect(hasPermission(role, "read")).toBe(false);
    }
  });
});

describe("step-up freshness", () => {
  const destructive = ADMIN_ROUTES.find((r) => r.destructive)!;
  const ordinary = ADMIN_ROUTES.find((r) => r.stepUp && !r.destructive)!;

  it("accepts an ordinary write inside the fifteen-minute window", () => {
    const d = authorize({
      path: ordinary.path, method: ordinary.method, role: "admin",
      stepUpAgeSeconds: STEP_UP_TTL_SECONDS - 1,
    });
    expect(d.allowed).toBe(true);
  });

  it("refuses an ordinary write once the window has passed", () => {
    const d = authorize({
      path: ordinary.path, method: ordinary.method, role: "admin",
      stepUpAgeSeconds: STEP_UP_TTL_SECONDS + 1,
    });
    expect(d.reason).toBe("step-up-required");
  });

  it("refuses a DESTRUCTIVE write on a step-up that is merely valid", () => {
    // The whole point: an irreversible action needs proof that the person is
    // at the keyboard NOW, not that they were fourteen minutes ago.
    const d = authorize({
      path: destructive.path, method: destructive.method, role: "admin",
      stepUpAgeSeconds: FRESH_STEP_UP_SECONDS + 1,
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("fresh-step-up-required");
  });

  it("accepts a destructive write on a genuinely fresh step-up", () => {
    const d = authorize({
      path: destructive.path, method: destructive.method, role: "admin",
      stepUpAgeSeconds: FRESH_STEP_UP_SECONDS - 1,
    });
    expect(d.allowed).toBe(true);
  });

  it("fresh is strictly shorter than the ordinary window", () => {
    expect(FRESH_STEP_UP_SECONDS).toBeLessThan(STEP_UP_TTL_SECONDS);
  });
});

describe("unknown routes are denied by absence", () => {
  it.each([
    ["../../etc/passwd", "GET"],
    ["retention/purgeall", "POST"],
    ["", "GET"],
    ["personas", "PUT"],
    ["totally-made-up", "DELETE"],
  ])("refuses %s %s", (path, method) => {
    const d = authorize({ path, method, role: "admin", stepUpAgeSeconds: 0 });
    expect(d.allowed).toBe(false);
  });

  /**
   * FINDING-08, found by this matrix.
   *
   * `users/../retention/purge` matched the `users` rule through the
   * `startsWith("users/")` prefix test, so it authorised under `manage:users`
   * while a consumer that normalised the path would execute `retention/purge`,
   * which requires `manage:retention`. Authorise as one route, execute as
   * another. Fixed by REFUSING traversal input rather than normalising it: a
   * guard and its consumer agreeing forever on one canonical form is a
   * standing invitation to the same bug.
   */
  it.each([
    "users/../retention/purge",
    "personas/../../users",
    "users/./../retention/purge",
    "users//retention",
    "users/%2e%2e/retention/purge",
    "users/..%2fretention",
    "users\\..\\retention",
  ])("FINDING-08: refuses the traversal path %s", (path) => {
    expect(isSafeAdminPath(path)).toBe(false);
    expect(routeFor(path, "POST")).toBeNull();
    for (const role of ROLE_ORDER) {
      const d = authorize({ path, method: "POST", role, stepUpAgeSeconds: 0 });
      expect(d.allowed, role).toBe(false);
      expect(d.reason).toBe("unknown-route");
    }
  });

  it("still accepts ordinary ids, including dots and dashes", () => {
    for (const p of ["users/usr_1a2b", "cases/CASE-001", "actors/actor-088", "posts/p.12"]) {
      expect(isSafeAdminPath(p), p).toBe(true);
    }
  });

  it("answers 404 for an unknown route, not 403", () => {
    // 403 would confirm the path exists and is merely forbidden, which maps the
    // admin surface for anyone probing it.
    expect(statusFor("unknown-route")).toBe(404);
  });

  it("matches sub-paths of a known route but not a longer sibling", () => {
    expect(routeFor("users/usr_123", "GET")).not.toBeNull();
    expect(routeFor("usersextra", "GET")).toBeNull();
  });

  it("tolerates leading and trailing slashes", () => {
    expect(routeFor("/personas/", "GET")).not.toBeNull();
  });
});

describe("destructive action names", () => {
  it("recognises the six irreversible operations", () => {
    for (const a of ["delete", "bulk-edit", "role-change", "retention-purge", "revoke-sessions", "reset-totp"]) {
      expect(isDestructive(a), a).toBe(true);
    }
  });

  it("does not treat an ordinary edit as destructive", () => {
    expect(isDestructive("edit")).toBe(false);
    expect(isDestructive("note")).toBe(false);
  });
});
