import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/users";
import { clientKey, rateLimit } from "@/lib/rateLimit";

// Signup is unauthenticated, so it is an account-enumeration and spam surface.
// Five per IP per fifteen minutes is generous for real use and useless for
// automation.
const LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

// Server-side signup — persists to data/users.json (bcrypt-hashed). Fully offline.
export async function POST(req: NextRequest) {
  const rl = rateLimit(clientKey(req, "signup"), LIMIT, WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many signup attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  let body: { email?: string; name?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const result = await createUser({
    email: body.email ?? "",
    name: body.name ?? "",
    password: body.password ?? "",
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, user: result.user }, { status: 201 });
}
