import { NextRequest, NextResponse } from "next/server";

// Server-side proxy to the FastAPI engine.
//
// THE TRUST BOUNDARY. The browser talks only to this route; it never learns the
// engine's URL and never receives an engine key. A browser-visible engine URL is
// a Critical finding (docs/ARCHITECTURE.md section 3, D3.1 objective 4).
//
// ENGINE_URL is deliberately NOT prefixed NEXT_PUBLIC_, so Next cannot inline it
// into client bundles even by accident.

export const dynamic = "force-dynamic";

const ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:8000";
const TIMEOUT_MS = 8000;

// Only these prefixes may be proxied. An allowlist rather than a passthrough so
// a future engine admin route cannot be reached from the browser by guessing.
const ALLOWED = [
  "health",
  "version",
  "feed",
  "sources",
  "extract",
  "graph",
  "style",
  "behaviour",
  "rebrand",
  "infra",
  "fusion",
  "audit",
  "export",
  "chain",
];

function isAllowed(path: string): boolean {
  const head = path.split("/")[0] ?? "";
  return ALLOWED.includes(head);
}

/** Never leaks the engine URL into a client-visible message. */
function offline(detail: string) {
  return NextResponse.json(
    {
      ok: false,
      engine: "offline",
      // Honest degradation, per the ARCHITECTURE section 7 contract. The UI
      // renders this verbatim as the "engine offline" badge.
      detail,
      items: [],
    },
    { status: 200 }
  );
}

async function forward(req: NextRequest, path: string, method: "GET" | "POST") {
  if (!isAllowed(path)) {
    return NextResponse.json({ ok: false, error: "Unknown engine route." }, { status: 404 });
  }

  const url = new URL(`${ENGINE_URL}/${path}`);
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.append(k, v));

  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  };
  if (method === "POST") {
    init.body = await req.text();
  }

  try {
    const res = await fetch(url, init);
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      // The engine promises JSON. Anything else means something is in front of
      // it (a proxy error page); do not forward it to the browser.
      return offline("Engine returned a non-JSON response.");
    }
    return NextResponse.json(body, { status: res.status });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return offline(
      timedOut
        ? "Engine did not respond in time. DEMO and LIVE modes are unaffected."
        : "Engine unreachable. DEMO and LIVE modes are unaffected."
    );
  }
}

export async function GET(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, ctx.params.path.join("/"), "GET");
}

export async function POST(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, ctx.params.path.join("/"), "POST");
}
