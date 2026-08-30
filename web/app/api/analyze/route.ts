import { NextRequest, NextResponse } from "next/server";
import { analyze } from "@/lib/extractor";

// Server-side NER. Keeps GROQ_API_KEY off the client. Always returns a result
// (Groq when a key is set, local extractor otherwise).
export async function POST(req: NextRequest) {
  let text = "";
  try {
    const body = await req.json();
    text = typeof body?.text === "string" ? body.text : "";
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  if (!text.trim()) {
    return NextResponse.json({ ok: false, error: "Empty text." }, { status: 400 });
  }

  const result = await analyze(text.slice(0, 4000));
  return NextResponse.json({ ok: true, ...result });
}
