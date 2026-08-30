import { NextRequest, NextResponse } from "next/server";

// Server-side proxy to the FastAPI engine.
//
// THE TRUST BOUNDARY. The browser talks only to this route; it never learns the
// engine's URL and never receives an engine key. ENGINE_URL is deliberately NOT
// prefixed NEXT_PUBLIC_, so Next cannot inline it into a client bundle.

export const dynamic = "force-dynamic";

const ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:8000";

// Fusion and audit routes do real computation. A cold first call took ~20s and
// an 8s ceiling reported it as "engine offline" on a healthy engine.
const TIMEOUT_MS = 45_000;

// An allowlist, not a passthrough: a future engine admin route must not be
// reachable from the browser by guessing.
const ALLOWED = [
  "health", "version", "sources", "extract",
  "actors", "actor", "export",
  "graph", "fusion", "audit",
  "infra", "chain", "tor",
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

  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  };
  if (method === "POST") init.body = await req.text();

  try {
    const res = await fetch(url, init);
    const text = await res.text();
    const ct = res.headers.get("content-type") ?? "";

    // Exports are CSV/PDF/JSON attachments; stream them through unchanged.
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
      return offline("Engine returned a malformed response.");
    }
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return offline(
      timedOut ? "Engine did not respond in time." : "Engine unreachable."
    );
  }
}

export async function GET(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, ctx.params.path.join("/"), "GET");
}

export async function POST(req: NextRequest, ctx: { params: { path: string[] } }) {
  return forward(req, ctx.params.path.join("/"), "POST");
}
