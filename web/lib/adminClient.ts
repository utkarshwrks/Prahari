"use client";

/**
 * The Command Panel's client (DEC-058).
 *
 * Every mutating call carries the CSRF header. Doing that here, once, rather
 * than at each call site is the point: a forgotten header at one of twenty call
 * sites is a 403 someone "fixes" by weakening the check.
 *
 * The client also translates the guard's structured refusal reasons into what
 * the analyst should DO next. The server already decides everything; this only
 * decides the wording, and the two cannot disagree because the reason string is
 * the same value on both sides.
 */

export interface AdminStatus {
  ok: boolean;
  authenticated: boolean;
  role?: string;
  permissions?: string[];
  enrolled?: boolean;
  csrf?: string;
  reason?: string;
  stepUp?: {
    ageSeconds: number | null;
    valid: boolean;
    fresh: boolean;
    ttlSeconds: number;
    freshSeconds: number;
  };
  sessions?: {
    id: string;
    current: boolean;
    createdAt: string;
    lastSeenAt: string;
    revoked: boolean;
  }[];
}

/** What the UI should do about a refusal, decided from the server's reason. */
export type RecoveryAction = "sign-in" | "step-up" | "fresh-step-up" | "reload" | "wait" | "none";

export interface AdminRefusal {
  ok: false;
  status: number;
  reason: string;
  detail: string;
  action: RecoveryAction;
  conflict?: { expected: string | null; actual: string };
}

export type AdminResult<T> = { ok: true; data: T } | AdminRefusal;

let csrf: string | null = null;

export async function refreshStatus(): Promise<AdminStatus> {
  const res = await fetch("/api/stepup/status", { cache: "no-store" });
  const body = (await res.json()) as AdminStatus;
  csrf = body.csrf ?? null;
  return body;
}

function actionFor(reason: string): RecoveryAction {
  if (reason === "no-session" || reason.startsWith("session-")) return "sign-in";
  if (reason === "step-up-required") return "step-up";
  if (reason === "fresh-step-up-required") return "fresh-step-up";
  if (reason === "csrf") return "reload";
  if (reason.startsWith("rate-limited")) return "wait";
  return "none";
}

async function call<T>(path: string, init: RequestInit = {}): Promise<AdminResult<T>> {
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" && !csrf) await refreshStatus();

  const res = await fetch(`/api/admin/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(method !== "GET" && csrf ? { "x-prahari-csrf": csrf } : {}),
      ...(init.headers ?? {}),
    },
  });

  const body = await res.json().catch(() => ({}));
  if (res.ok) return { ok: true, data: body as T };

  // A 409 from the store carries both timestamps so the UI can show what
  // changed underneath rather than just refusing.
  const detail = body?.detail;
  const conflict =
    detail && typeof detail === "object" && "actual_updated_at" in detail
      ? { expected: detail.expected_updated_at ?? null, actual: detail.actual_updated_at }
      : undefined;

  const reason = String(body?.error ?? (res.status === 409 ? "conflict" : "failed"));
  return {
    ok: false,
    status: res.status,
    reason,
    detail:
      typeof detail === "string"
        ? detail
        : typeof detail?.message === "string"
          ? detail.message
          : (body?.detail && JSON.stringify(body.detail)) || "The request was refused.",
    action: actionFor(reason),
    conflict,
  };
}

export const admin = {
  status: refreshStatus,

  list: <T>(kind: string, params: Record<string, string> = {}) =>
    call<T>(`${kind}?${new URLSearchParams(params)}`),

  create: <T>(kind: string, id: string, patch: Record<string, unknown>, reason?: string) =>
    call<T>(`${kind}?id=${encodeURIComponent(id)}`, {
      method: "POST",
      body: JSON.stringify({ patch, reason }),
    }),

  update: <T>(
    kind: string,
    id: string,
    patch: Record<string, unknown>,
    expectedUpdatedAt: string | null,
    reason?: string
  ) =>
    call<T>(`${kind}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ patch, expected_updated_at: expectedUpdatedAt, reason }),
    }),

  softDelete: <T>(kind: string, id: string, expectedUpdatedAt: string | null, reason?: string) =>
    call<T>(
      `${kind}/${encodeURIComponent(id)}?${new URLSearchParams({
        ...(expectedUpdatedAt ? { expected_updated_at: expectedUpdatedAt } : {}),
        ...(reason ? { reason } : {}),
      })}`,
      { method: "DELETE" }
    ),

  restore: <T>(kind: string, id: string) =>
    call<T>(`${kind}/${encodeURIComponent(id)}/restore`, { method: "POST" }),

  bulkImport: <T>(kind: string, csvText: string, dryRun: boolean, reason?: string) =>
    call<T>("bulk/import", {
      method: "POST",
      body: JSON.stringify({ kind, csv: csvText, dry_run: dryRun, reason }),
    }),

  purge: <T>(
    kind: string,
    before: string,
    dryRun: boolean,
    reason?: string,
    secondApprover?: string
  ) =>
    call<T>("retention/purge", {
      method: "POST",
      body: JSON.stringify({
        kind,
        before,
        dry_run: dryRun,
        reason,
        second_approver: secondApprover,
      }),
    }),

  analytics: <T>(scope: string) => call<T>(`analytics/${scope}`),
  activity: <T>() => call<T>("audit/activity"),
};

/** Step-up endpoints live outside /api/admin: they are how you GET authorised. */
export async function verifyStepUp(code: string) {
  if (!csrf) await refreshStatus();
  const res = await fetch("/api/stepup/verify", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(csrf ? { "x-prahari-csrf": csrf } : {}) },
    body: JSON.stringify({ code }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

export async function beginEnrolment(force = false) {
  if (!csrf) await refreshStatus();
  const res = await fetch("/api/stepup/enrol", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(csrf ? { "x-prahari-csrf": csrf } : {}) },
    body: JSON.stringify({ force }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
