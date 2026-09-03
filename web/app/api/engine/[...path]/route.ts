import { NextRequest, NextResponse } from "next/server";

// Server-side proxy to the FastAPI engine.
//
// THE TRUST BOUNDARY. The browser talks only to this route; it never learns the
// engine's URL and never receives an engine key. ENGINE_URL is deliberately NOT
// prefixed NEXT_PUBLIC_, so Next cannot inline it into a client bundle.

export const dynamic = "force-dynamic";

const RAW_ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:8000";
// Render's fromService wiring provides a bare host (no scheme); normalise it so
// the proxy always has a valid absolute base URL.
const ENGINE_URL = /^https?:\/\//.test(RAW_ENGINE_URL) ? RAW_ENGINE_URL : `https://${RAW_ENGINE_URL}`;

// Fusion and audit routes do real computation. A cold first call took ~20s and
// an 8s ceiling reported it as "engine offline" on a healthy engine.
//
// The engine sleeps on Render's free plan. A measured cold start took 77s — past
// this ceiling — so the FIRST call after an idle period timed out and the
// workbench declared a healthy engine dead. One attempt cannot both fail fast on
// a real outage and survive a cold start, so we do two: the first ends at 45s
// (having woken the instance), the retry lands on a warm engine.
const TIMEOUT_MS = 45_000;
const RETRY_TIMEOUT_MS = 60_000;

// An allowlist, not a passthrough: a future engine admin route must not be
// reachable from the browser by guessing.
const ALLOWED = [
  "health", "version", "sources", "extract",
  "actors", "actor", "export",
  "graph", "fusion", "audit",
  "infra", "chain", "tor", "geo",
  "feed", "style", "behaviour", "rebrand", "compare",
];

function isAllowed(path: string): boolean {
  return ALLOWED.includes(path.split("/")[0] ?? "");
}

function offline(detail: string) {
  // HTTP 200 with an honest body: the workbench must be able to tell
  // "engine down" from "request failed", and render a badge either way.
  return NextResponse.json(
    { ok: false, engine: "offline", detail, items: [], actors: [], results: [] },
    { status: 200 }
  );
}

async function forward(req: NextRequest, path: string, method: "GET" | "POST") {
  if (!isAllowed(path)) {
    return NextResponse.json({ ok: false, error: "Unknown engine route." }, { status: 404 });
  }

  const url = new URL(`${ENGINE_URL}/${path}`);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.append(k, v));

  const body = method === "POST" ? await req.text() : undefined;

  const attempt = (timeoutMs: number) =>
    fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
      ...(body === undefined ? {} : { body }),
    });

  const isTimeout = (e: unknown) => e instanceof Error && e.name === "TimeoutError";

  try {
    let res: Response;
    try {
      res = await attempt(TIMEOUT_MS);
    } catch (err) {
      // Retry only GET. POST routes seal the ledger and anchor on-chain; a
      // replay of one is worse than an honest timeout.
      if (!isTimeout(err) || method !== "GET") throw err;
      res = await attempt(RETRY_TIMEOUT_MS);
    }

    const text = await res.text();
    const ct = res.headers.get("content-type") ?? "";

    // Exports are CSV/PDF/JSON attachments; stream them through unchanged.
    if (!ct.includes("application/json")) {
      // ...but only on success. A failing upstream answers in HTML — Render's
      // "This service has been suspended by its owner." page, a 502, a 504 —
      // and streaming that HTML back made the browser's res.json() throw, so
      // the workbench blamed an unreachable engine and hid the real cause.
      if (!res.ok) {
        return offline(
          `Engine returned HTTP ${res.status}. Check that ENGINE_URL points at a running engine.`
        );
      }
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
      return offline("Engine returned a malformed response.");
    }
  } catch (err) {
    return offline(
      isTimeout(err) ? "Engine did not respond in time." : "Engine unreachable."
    );
  }
}

export async function GET(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, ctx.params.path.join("/"), "GET");
}

export async function POST(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, ctx.params.path.join("/"), "POST");
}
