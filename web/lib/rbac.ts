/**
 * THE ROLE HIERARCHY (DEC-058).
 *
 * Extends the existing `officer` / `analyst` model in `authConfig.ts` without
 * changing either of them: both keep exactly the permissions they had, and
 * `can()` there continues to work for every existing call site. `viewer`,
 * `supervisor` and `admin` are added around them.
 *
 * The ordering below is a genuine hierarchy — each role is a superset of the
 * one before — and `rbac.test.ts` asserts that. It matters because the whole
 * authorisation model reduces to a subset check, and a hierarchy with a hole in
 * it (a supervisor who cannot do something an officer can) turns every
 * permission question into a special case.
 *
 * THE UI CHECK IS A CONVENIENCE, NOT A CONTROL. Everything here is also
 * enforced server-side on every mutation, in `adminGuard.ts`, and again in the
 * engine. Three layers, because the browser is not a trust boundary and a
 * disabled button is not a permission system.
 */
import { ROLE_PERMISSIONS as BASE, type Role as BaseRole } from "./authConfig";

export type Role = "viewer" | BaseRole | "supervisor" | "admin";

/** Least to most privileged. Index is the rank. */
export const ROLE_ORDER: Role[] = ["viewer", "analyst", "officer", "supervisor", "admin"];

const VIEWER = ["read"] as const;

const SUPERVISOR = [
  ...BASE.officer,
  "manage:cases",
  "manage:sources",
  "approve",
  "reassign",
] as const;

const ADMIN = [
  ...SUPERVISOR,
  "manage:users",
  "manage:roles",
  "manage:retention",
] as const;

/**
 * The permission sets.
 *
 * `analyst` and `officer` are spread from `authConfig.ROLE_PERMISSIONS`, not
 * retyped, so the two files cannot drift and the older `can()` keeps agreeing
 * with this one.
 */
export const PERMISSIONS: Record<Role, readonly string[]> = {
  viewer: VIEWER,
  analyst: BASE.analyst,
  officer: BASE.officer,
  supervisor: SUPERVISOR,
  admin: ADMIN,
};

/**
 * `impersonate` is deliberately absent from every role, including admin.
 *
 * The playbook lists `impersonate:none` for admin. Rather than mint a
 * permission whose value is the string "none" -- which a careless
 * `hasPermission(role, "impersonate:none")` would happily return true for --
 * the capability simply does not exist anywhere in this table. An admin cannot
 * act as another user, and there is no code path that could be persuaded
 * otherwise. `rbac.test.ts` asserts no role holds any `impersonate` permission.
 */
export const IMPERSONATION_SUPPORTED = false;

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLE_ORDER as string[]).includes(v);
}

export function rankOf(role: string | undefined): number {
  return isRole(role) ? ROLE_ORDER.indexOf(role) : -1;
}

/** Does `role` hold `permission`? Unknown roles hold nothing. */
export function hasPermission(role: string | undefined, permission: string): boolean {
  if (!isRole(role)) return false;
  return PERMISSIONS[role].includes(permission);
}

/** Every permission a role holds, sorted. */
export function permissionsOf(role: string | undefined): readonly string[] {
  return isRole(role) ? [...PERMISSIONS[role]].sort() : [];
}

/** Is `role` at least as privileged as `min`? */
export function atLeast(role: string | undefined, min: Role): boolean {
  const r = rankOf(role);
  return r >= 0 && r >= ROLE_ORDER.indexOf(min);
}

// ---------------------------------------------------------------------------
// Destructive actions.
//
// These require a FRESH step-up regardless of the 15-minute window: the point
// of a step-up is that the person at the keyboard proved possession of the
// second factor, and for an irreversible action "fourteen minutes ago" is not
// good enough.
// ---------------------------------------------------------------------------

export const DESTRUCTIVE_ACTIONS = [
  "delete",
  "bulk-edit",
  "role-change",
  "retention-purge",
  "revoke-sessions",
  "reset-totp",
] as const;

export type DestructiveAction = (typeof DESTRUCTIVE_ACTIONS)[number];

export function isDestructive(action: string): action is DestructiveAction {
  return (DESTRUCTIVE_ACTIONS as readonly string[]).includes(action);
}

// ---------------------------------------------------------------------------
// The endpoint authorisation matrix.
//
// One table, consulted by the web guard and mirrored by the engine. Written as
// data rather than as scattered `if` statements precisely so it can be tested
// exhaustively: `authz.test.ts` walks every role against every entry.
// ---------------------------------------------------------------------------

export interface AdminRoute {
  /** Path under /admin, without the prefix. */
  path: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  permission: string;
  /** Writes need a step-up token; reads do not. */
  stepUp: boolean;
  /** Destructive writes need a FRESH one. */
  destructive?: boolean;
}

export const ADMIN_ROUTES: AdminRoute[] = [
  // --- reads ---
  { path: "personas", method: "GET", permission: "read", stepUp: false },
  { path: "posts", method: "GET", permission: "read", stepUp: false },
  { path: "entities", method: "GET", permission: "read", stepUp: false },
  { path: "actors", method: "GET", permission: "read", stepUp: false },
  { path: "cases", method: "GET", permission: "read", stepUp: false },
  { path: "sources", method: "GET", permission: "manage:sources", stepUp: false },
  { path: "users", method: "GET", permission: "manage:users", stepUp: false },
  { path: "analytics", method: "GET", permission: "read", stepUp: false },
  { path: "audit/activity", method: "GET", permission: "manage:cases", stepUp: false },

  // --- writes ---
  { path: "personas", method: "POST", permission: "manage:cases", stepUp: true },
  { path: "personas", method: "PATCH", permission: "manage:cases", stepUp: true },
  { path: "personas", method: "DELETE", permission: "manage:cases", stepUp: true, destructive: true },
  { path: "posts", method: "PATCH", permission: "manage:cases", stepUp: true },
  { path: "posts", method: "DELETE", permission: "manage:cases", stepUp: true, destructive: true },
  { path: "entities", method: "POST", permission: "manage:cases", stepUp: true },
  { path: "entities", method: "PATCH", permission: "manage:cases", stepUp: true },
  { path: "actors", method: "PATCH", permission: "approve", stepUp: true },
  { path: "cases", method: "POST", permission: "manage:cases", stepUp: true },
  { path: "cases", method: "PATCH", permission: "manage:cases", stepUp: true },
  { path: "sources", method: "PATCH", permission: "manage:sources", stepUp: true },
  { path: "users", method: "POST", permission: "manage:users", stepUp: true },
  { path: "users", method: "PATCH", permission: "manage:roles", stepUp: true, destructive: true },
  { path: "bulk/import", method: "POST", permission: "manage:cases", stepUp: true, destructive: true },
  { path: "retention/purge", method: "POST", permission: "manage:retention", stepUp: true, destructive: true },
];

/**
 * Is this path safe to match against the table?
 *
 * FOUND BY THE AUTHZ MATRIX. `users/../retention/purge` matched the `users`
 * rule through the `startsWith("users/")` prefix test, so it would have been
 * authorised under `manage:users` -- while any consumer that normalised the
 * path would then execute `retention/purge`, which requires
 * `manage:retention`. Authorise as one route, execute as another: a
 * privilege-escalation shape, and precisely the reason this matrix walks every
 * cell instead of the ones someone thought of.
 *
 * The fix is to refuse the input rather than to normalise it. Normalising means
 * the guard and the consumer must agree forever on one canonical form, and any
 * future disagreement is another instance of this bug. A traversal segment has
 * no legitimate use in an admin path, so it is simply not a valid request.
 */
export function isSafeAdminPath(path: string): boolean {
  if (path.includes("%") || path.includes("\\") || path.includes("\0")) return false;
  const segments = path.replace(/^\/+|\/+$/g, "").split("/");
  if (segments.length === 0) return false;
  return segments.every((s) => s.length > 0 && s !== "." && s !== ".." && /^[A-Za-z0-9_.-]+$/.test(s));
}

/** Look up the rule for a request. Unknown paths are denied by absence. */
export function routeFor(path: string, method: string): AdminRoute | null {
  if (!isSafeAdminPath(path)) return null;
  const clean = path.replace(/^\/+|\/+$/g, "");
  return (
    ADMIN_ROUTES.find(
      (r) => r.method === method && (clean === r.path || clean.startsWith(`${r.path}/`))
    ) ?? null
  );
}

export interface AuthzDecision {
  allowed: boolean;
  /** Machine-readable reason, so the UI and the ledger say the same thing. */
  reason:
    | "ok"
    | "unknown-route"
    | "no-session"
    | "insufficient-role"
    | "step-up-required"
    | "fresh-step-up-required";
  route: AdminRoute | null;
}

export interface AuthzInput {
  path: string;
  method: string;
  role: string | undefined;
  /** Age of the step-up token in seconds, or null when there is none. */
  stepUpAgeSeconds: number | null;
}

/** Fresh means "within the last two minutes". */
export const FRESH_STEP_UP_SECONDS = 120;
/** A step-up is otherwise good for fifteen minutes. */
export const STEP_UP_TTL_SECONDS = 15 * 60;

/**
 * The single authorisation decision, shared by the middleware and the handlers.
 *
 * Returning a structured reason rather than a boolean is deliberate: the same
 * value drives the HTTP status, the message the analyst sees, and the ledger
 * entry, so those three can never describe the refusal differently.
 */
export function authorize(input: AuthzInput): AuthzDecision {
  const route = routeFor(input.path, input.method);
  if (!route) return { allowed: false, reason: "unknown-route", route: null };
  if (!input.role) return { allowed: false, reason: "no-session", route };
  if (!hasPermission(input.role, route.permission)) {
    return { allowed: false, reason: "insufficient-role", route };
  }
  if (route.stepUp) {
    if (input.stepUpAgeSeconds === null || input.stepUpAgeSeconds > STEP_UP_TTL_SECONDS) {
      return { allowed: false, reason: "step-up-required", route };
    }
    if (route.destructive && input.stepUpAgeSeconds > FRESH_STEP_UP_SECONDS) {
      return { allowed: false, reason: "fresh-step-up-required", route };
    }
  }
  return { allowed: true, reason: "ok", route };
}

/** HTTP status for a decision. 404 for unknown routes: do not map the surface. */
export function statusFor(reason: AuthzDecision["reason"]): number {
  switch (reason) {
    case "ok":
      return 200;
    case "unknown-route":
      return 404;
    case "no-session":
      return 401;
    case "insufficient-role":
      return 403;
    default:
      // 403 with a distinct body, not 401: the session is valid, the step-up
      // is what is missing, and telling the client to log in again would send
      // it down the wrong recovery path.
      return 403;
  }
}
