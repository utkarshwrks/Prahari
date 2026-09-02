/**
 * Service status, with a THIRD state that is not "offline" (DEC-063).
 *
 * The footer links PRAHARI v1 at `https://prahari-6njh.onrender.com`, which is
 * a free Render service and therefore asleep most of the time. A dot that said
 * "offline" would be wrong twice over: the service is fine, and a judge who
 * read "offline" would not click the link that is the whole point of the
 * footer.
 *
 * Four states, and the distinction between the last two is the honest part:
 *
 *   live      answered within the budget
 *   waking    reachable but slow, or known to be a cold-starting free service
 *   unknown   the CHECK ITSELF failed — we do not know, and say so
 *   checking  in flight
 *
 * "unknown" is never rendered as "offline". A failed check is a fact about our
 * knowledge, not about the service, and INV-5 does not stop at the map.
 */

export type ServiceState = "checking" | "live" | "waking" | "unknown";

export interface ServiceStatus {
  state: ServiceState;
  /** What the dot's tooltip and the screen-reader text say. */
  label: string;
  /** Round-trip in ms, when we got one. */
  latencyMs: number | null;
  checkedAt: string | null;
}

/** A free Render instance cold-starts in roughly this long. */
export const COLD_START_HINT_S = 60;

/** Past this, a reachable service is reported as waking rather than live. */
export const SLOW_MS = 3_000;

export const INITIAL: ServiceStatus = {
  state: "checking",
  label: "Checking…",
  latencyMs: null,
  checkedAt: null,
};

export function describe(state: ServiceState, latencyMs: number | null): string {
  switch (state) {
    case "live":
      return latencyMs === null ? "Live" : `Live · ${latencyMs} ms`;
    case "waking":
      // The number a judge needs, not a vague "please wait".
      return `Waking — may take 30–${COLD_START_HINT_S} s`;
    case "unknown":
      // NOT "offline". We could not check; that is all we know.
      return "Status unknown — the check did not complete";
    default:
      return "Checking…";
  }
}

/**
 * Probe a URL and classify the result.
 *
 * `mode: "no-cors"` for the cross-origin v1 check: we cannot read the response,
 * and we do not need to. Whether the request COMPLETED is the whole signal, and
 * asking for more would need CORS headers on a service we do not control.
 *
 * A non-2xx is still "live": an HTTP error means something answered, which is
 * exactly what the dot is reporting.
 */
export async function probe(
  url: string,
  { timeoutMs = 8_000, mode }: { timeoutMs?: number; mode?: RequestMode } = {}
): Promise<ServiceStatus> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetch(url, {
      method: "GET",
      mode,
      cache: "no-store",
      signal: controller.signal,
      redirect: "follow",
    });
    const latencyMs = Date.now() - started;
    const state: ServiceState = latencyMs > SLOW_MS ? "waking" : "live";
    return { state, label: describe(state, latencyMs), latencyMs, checkedAt: new Date().toISOString() };
  } catch (err) {
    const latencyMs = Date.now() - started;
    /**
     * A timeout on a known free service is a COLD START, not a failure.
     *
     * That is the distinction the footer exists to make. Anything else — DNS
     * failure, a blocked request, an offline browser — is "unknown", because we
     * genuinely do not know whether the service is up.
     */
    const aborted = err instanceof Error && err.name === "AbortError";
    const state: ServiceState = aborted ? "waking" : "unknown";
    return {
      state,
      label: describe(state, null),
      latencyMs: aborted ? latencyMs : null,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** The engine, through the allowlisted proxy. Same badge semantics. */
export async function probeEngine(): Promise<ServiceStatus> {
  const started = Date.now();
  try {
    const res = await fetch("/api/engine/health", { cache: "no-store" });
    const body = (await res.json()) as { ok?: boolean; engine?: string };
    const latencyMs = Date.now() - started;

    // The proxy answers 200 with `engine: "offline"` when it cannot reach the
    // engine (DEC-017's degradation contract). That IS knowledge, unlike a
    // failed check, so it is reported as waking rather than unknown -- a cold
    // engine on the free tier is the overwhelmingly likely cause.
    if (body?.engine === "offline") {
      return {
        state: "waking",
        label: describe("waking", null),
        latencyMs,
        checkedAt: new Date().toISOString(),
      };
    }
    const state: ServiceState = latencyMs > SLOW_MS ? "waking" : "live";
    return { state, label: describe(state, latencyMs), latencyMs, checkedAt: new Date().toISOString() };
  } catch {
    return { state: "unknown", label: describe("unknown", null), latencyMs: null, checkedAt: new Date().toISOString() };
  }
}

/** The v1 deployment this project links to. */
export const V1_URL = "https://prahari-6njh.onrender.com";
