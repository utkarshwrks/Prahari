import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import QRCode from "qrcode";
import { AUTH_SECRET } from "@/lib/authConfig";
import { check as checkSession, verifyCsrf } from "@/lib/sessions";
import { beginEnrolment, isEnrolled } from "@/lib/totpStore";
import { ipAllowed } from "@/lib/ipAllowlist";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * TOTP enrolment (DEC-059).
 *
 * Returns the otpauth URI, a QR code as a data URI, and the eight recovery
 * codes IN PLAINTEXT — the only time they are ever transmitted. Only hashes are
 * stored, so a lost sheet cannot be recovered, and the response says so.
 *
 * Re-enrolment requires `force: true` and invalidates the old secret. Silently
 * overwriting would let anyone with a live session replace the second factor
 * with one they control, which would make the whole mechanism decorative.
 */
export async function POST(req: NextRequest) {
  if (!ipAllowed(req.headers)) {
    return NextResponse.json({ ok: false, detail: "Not permitted from this address." }, { status: 403 });
  }
  const token = await getToken({ req, secret: AUTH_SECRET });
  const sid = typeof token?.sid === "string" ? token.sid : null;
  if (!token || !sid || !checkSession(sid).valid) {
    return NextResponse.json({ ok: false, detail: "Sign in to continue." }, { status: 401 });
  }
  if (!verifyCsrf(sid, AUTH_SECRET, req.headers.get("x-prahari-csrf"))) {
    return NextResponse.json({ ok: false, detail: "Invalid CSRF token." }, { status: 403 });
  }

  const userId = String(token.id ?? "");
  const email = String(token.email ?? "");

  // Enrolment is cheap but it rotates a secret; a loop of it would let someone
  // churn a victim's second factor. Three per hour is generous for a real user.
  if (!rateLimit(`enrol:${userId}`, 3, 60 * 60 * 1000).ok) {
    return NextResponse.json(
      { ok: false, detail: "Too many enrolment attempts. Try again later." },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { force?: boolean };
  const already = await isEnrolled(userId);
  const result = await beginEnrolment(userId, email, body.force === true);
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        detail: "Already enrolled. Re-enrolling replaces your existing authenticator.",
        alreadyEnrolled: true,
      },
      { status: 409 }
    );
  }

  const qr = await QRCode.toDataURL(result.uri, { margin: 1, width: 240 }).catch(() => null);
  return NextResponse.json({
    ok: true,
    replaced: already,
    uri: result.uri,
    qr,
    recoveryCodes: result.recoveryCodes,
    honesty:
      "These eight recovery codes are shown once and stored only as hashes. If you lose them, " +
      "an administrator must reset your enrolment — they cannot be recovered.",
  });
}
