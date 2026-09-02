import { NextResponse, type NextRequest } from "next/server";
import { guard, needsLedgerEntry } from "@/lib/adminGuard";
import { serviceToken } from "@/lib/serviceToken";

/**
 * THE ADMIN TRUST BOUNDARY (DEC-058, DEC-060).
 *
 * A SECOND proxy, deliberately separate from `/api/engine/[...path]`.
 *
 * The existing engine proxy is an allowlist for read paths a signed-in analyst
 * may reach. Admin paths are a different class of thing: they mutate evidence,
 * and they need a role check, a CSRF check, a step-up check, a rate limit and a
 * ledger entry. Bolting all of that onto the existing route would mean one
 * function whose behaviour depends on which arm of a branch it took — and the
 * failure mode of getting that branch wrong is an unauthenticated purge.
 *
 * Two routes, two allowlists, one shared decision table. `/admin` is NOT added
 * to the read proxy's ALLOWED array, and `security.test.ts` asserts it never is.
 *
 * The engine authorises INDEPENDENTLY. This proxy sends a signed service token
 * carrying the acting user and role, and the engine verifies it itself — it does
 * not assume this proxy is the only caller, because on a Render deployment the
 * engine has its own public URL.
 */

export const dynamic = "force-dynamic";

const RAW_ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:8000";
const ENGINE_URL = /^https?:\/\//.test(RAW_ENGINE_URL) ? RAW_ENGINE_URL : `https://${RAW_ENGINE_URL}`;
const TIMEOUT_MS = 45_000;

/**
 * The admin allowlist, derived from the SAME table the guard authorises against.
 *
 * Deriving rather than restating means a route can never be reachable without
 * an authorisation rule, nor have a rule without being reachable. Both
 * mismatches are silent in a hand-maintained pair of lists.
 */
import { ADMIN_ROUTES } from "@/lib/rbac";
const ALLOWED_PREFIXES = [...new Set(ADMIN_ROUTES.map((r) => r.path.split("/")[0]))];

function isAllowedPrefix(path: string): boolean {
  return ALLOWED_PREFIXES.includes(path.split("/")[0] ?? "");
}

function refuse(status: number, reason: string, detail: string, retryAfter?: number) {
  return NextResponse.json(
    { ok: false, error: reason, detail },
    {
      status,
      headers: retryAfter ? { "Retry-After": String(retryAfter) } : undefined,
    }
  );
}

async function forward(req: NextRequest, path: string) {
  const method = req.method.toUpperCase();

  // Prefix check before the guard: an unknown surface should not consume a
  // rate-limit budget or produce a ledger entry.
  if (!isAllowedPrefix(path)) {
    return refuse(404, "unknown-route", "Unknown admin route.");
  }

  const g = await guard(req, path);
  if (!g.ok) {
    return refuse(g.status, g.reason, g.detail, g.retryAfter);
  }

  const url = new URL(`${ENGINE_URL}/admin/${path}`);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.append(k, v));

  const body = method === "GET" ? undefined : await req.text();

  /**
   * Mint the token before anything else, and turn a missing secret into an
   * honest refusal rather than a 500.
   *
   * `serviceSecret()` throws in production when ENGINE_SERVICE_SECRET is unset
   * -- correctly, because a known key would make the engine's independent check
   * a formality. But an unhandled throw here surfaces as a bare 500 with a
   * stack trace in the log and nothing useful on screen. INV-9: name the
   * dependency that is missing and what to do about it.
   */
  let bearer: string;
  try {
    bearer = serviceToken({
      sub: g.ctx.userId,
      email: g.ctx.email,
      role: g.ctx.role,
      path,
      method,
    });
  } catch (e) {
    return refuse(
      503,
      "not-configured",
      e instanceof Error ? e.message : "The admin scope is not configured on this deployment."
    );
  }

  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      // The engine verifies this itself. It carries who is acting and with what
      // role, signed, so the engine never has to trust the caller's word.
      Authorization: `Bearer ${bearer}`,
      // Echoed for the engine's own ledger entry, so the chain records the
      // human, not the service account.
      "X-Prahari-Actor": g.ctx.email,
      "X-Prahari-Role": g.ctx.role,
      "X-Prahari-Ledger": needsLedgerEntry(method) ? "required" : "no",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  };
  if (body !== undefined) init.body = body;

  try {
    const res = await fetch(url, init);
    const text = await res.text();
    const ct = res.headers.get("content-type") ?? "";

    if (!ct.includes("application/json")) {
      return new NextResponse(text, {
        status: res.status,
        headers: {
          "Content-Type": ct || "text/plain",
          ...(res.headers.get("content-disposition")
            ? { "Content-Disposition": res.headers.get("content-disposition") as string }
            : {}),
        },
      });
    }

    try {
      return NextResponse.json(JSON.parse(text), { status: res.status });
    } catch {
      return refuse(502, "malformed", "The engine returned a malformed response.");
    }
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    /**
     * A mutation that timed out is reported as UNKNOWN, not as failed.
     *
     * The read proxy answers 200 with `engine: offline` because a failed read
     * costs nothing. A mutation is different: the engine may well have applied
     * it before the connection dropped, and telling an analyst "that failed"
     * invites them to retry a change that already happened. 504 with an
     * explicit instruction to go and look is the honest answer.
     */
    return refuse(
      timedOut ? 504 : 502,
      timedOut ? "timeout" : "unreachable",
      timedOut
        ? "The engine did not respond in time. This request may or may not have been applied — check the case ledger before retrying."
        : "The engine is unreachable. No change was made."
    );
  }
}

export async function GET(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, ctx.params.path.join("/"));
}
export async function POST(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, ctx.params.path.join("/"));
}
export async function PATCH(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, ctx.params.path.join("/"));
}
export async function DELETE(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, ctx.params.path.join("/"));
}
