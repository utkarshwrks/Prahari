import { NextResponse, type NextRequest } from "next/server";

/**
 * The web service's keep-alive endpoint (DEC-064).
 *
 * STATIC BY DEFAULT. No session lookup, no engine call, no database. Its only
 * job is to be an inbound request that resets Render's 15-minute idle timer,
 * and that requires nothing but answering — a keep-alive that does work is a
 * keep-alive that consumes the thing it is protecting.
 *
 * `?deep=1` optionally proxies the engine's own ping through the existing
 * allowlisted proxy, for a single call that wakes both services. It is opt-in
 * precisely because the default must stay cheap: a scheduled deep ping every
 * ten minutes would wake the engine even on days nobody uses it.
 */

export const dynamic = "force-dynamic";

const STARTED_AT = Date.now();

export async function GET(req: NextRequest) {
  const deep = req.nextUrl.searchParams.get("deep") === "1";

  const body: Record<string, unknown> = {
    ok: true,
    service: "prahari-web",
    uptime_s: Math.round((Date.now() - STARTED_AT) / 1000),
    awake_since: new Date(STARTED_AT).toISOString(),
    checked_at: new Date().toISOString(),
    deep,
  };

  if (deep) {
    const started = Date.now();
    try {
      const res = await fetch(
        `${process.env.ENGINE_URL ?? "http://localhost:8000"}/health/ping`,
        { cache: "no-store", signal: AbortSignal.timeout(20_000) }
      );
      body.engine = { ok: res.ok, status: res.status, latency_ms: Date.now() - started };
    } catch (err) {
      /**
       * A failed deep ping does NOT make this endpoint fail.
       *
       * The web service is up — that is what this route reports. Answering 503
       * because the engine is cold would tell the scheduler to mark the WEB
       * service down, and the keep-alive would then be reporting the wrong
       * service as broken.
       */
      body.engine = {
        ok: false,
        latency_ms: Date.now() - started,
        detail:
          err instanceof Error && err.name === "TimeoutError"
            ? "The engine did not answer in time — it is probably cold-starting."
            : "The engine was unreachable.",
      };
    }
  }

  return NextResponse.json(body, {
    // Never cached: a cached 200 from an edge would keep the scheduler happy
    // while the service itself was asleep, which defeats the entire mechanism.
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
