import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/users";

// Server-side signup — persists to data/users.json (bcrypt-hashed). Fully offline.
export async function POST(req: NextRequest) {
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
