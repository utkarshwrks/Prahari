/**
 * In-process rate limiting for the two unauthenticated endpoints.
 *
 * `/api/signup` and the credentials callback are the only routes reachable
 * without a session, which makes them the only places an attacker can
 * brute-force a password or enumerate accounts. v1 had no limit at all.
 *
 * A fixed-window counter in module scope, deliberately: the playbook forbids
 * Redis, and a single-node on-prem deployment does not need it. The limitation
 * is real and stated rather than hidden -- behind multiple instances each
 * process keeps its own window, so the effective limit multiplies by instance
 * count. For a district cyber cell running one node that is correct; for a
 * horizontally scaled deployment it needs a shared store.
 */

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

// Bound the map so a flood of unique IPs cannot exhaust memory. Evicting the
// oldest window is safe: the worst case is an attacker regaining a few
// attempts, which is far better than an OOM.
const MAX_BUCKETS = 10_000;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    if (buckets.size >= MAX_BUCKETS) {
      const oldest = buckets.keys().next().value;
      if (oldest !== undefined) buckets.delete(oldest);
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);
  return {
    ok: existing.count <= limit,
    remaining,
    retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
  };
}

/** Best-effort client identity behind a proxy. */
export function clientKey(req: Request, scope: string): string {
  const h = req.headers;
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  return `${scope}:${ip}`;
}

export function resetAll(): void {
  buckets.clear();
}
