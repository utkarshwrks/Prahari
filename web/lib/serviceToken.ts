/**
 * THE SERVICE TOKEN — the engine authorises independently (DEC-060).
 *
 * "The proxy already checked" is not an authorisation model. On a Render
 * deployment the engine has its own public URL, so anything that can reach the
 * network can reach `/admin/*` directly. The engine therefore verifies for
 * itself who is acting and with what role.
 *
 * A short-lived HMAC-signed token rather than a JWT library: the payload is
 * five fields, the algorithm is HMAC-SHA256, and both sides are code we own.
 * Adding a JWT dependency to sign five fields would be more surface, not less.
 *
 * The token is BOUND TO THE REQUEST — path and method are inside the signature.
 * A token minted for `GET /admin/users` cannot be replayed against
 * `POST /admin/retention/purge`, which is the whole point: without binding, a
 * token captured from any admin read would be a general-purpose admin
 * credential for its lifetime.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** Sixty seconds. It exists to cross one hop, not to be stored. */
export const SERVICE_TOKEN_TTL_SECONDS = 60;

export interface ServiceClaims {
  sub: string;
  email: string;
  role: string;
  path: string;
  method: string;
}

interface Payload extends ServiceClaims {
  iat: number;
  exp: number;
}

/**
 * The shared secret.
 *
 * In production its absence is a boot-time failure, exactly as with
 * NEXTAUTH_SECRET (DEC-045) and PASSWORD_PEPPER: a known signing key means
 * anyone can mint an admin token, so falling back to a default would turn the
 * engine's independent check into a formality.
 */
export function serviceSecret(): string {
  const configured = process.env.ENGINE_SERVICE_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error(
      "PRAHARI refuses to start in production without ENGINE_SERVICE_SECRET. " +
        "The engine uses it to authorise admin calls independently of the web layer. " +
        "Generate one with `openssl rand -base64 32` and set it on BOTH services."
    );
  }
  return "prahari-local-development-service-secret-not-for-production";
}

const b64u = (b: Buffer) => b.toString("base64url");

function sign(body: string, secret: string): string {
  return b64u(createHmac("sha256", secret).update(body).digest());
}

export function serviceToken(
  claims: ServiceClaims,
  atMs: number = Date.now(),
  secret: string = serviceSecret()
): string {
  const payload: Payload = {
    ...claims,
    // Path is normalised to the form the engine will see, so a trailing slash
    // on one side cannot invalidate an otherwise good token.
    path: claims.path.replace(/^\/+|\/+$/g, ""),
    method: claims.method.toUpperCase(),
    iat: Math.floor(atMs / 1000),
    exp: Math.floor(atMs / 1000) + SERVICE_TOKEN_TTL_SECONDS,
  };
  const body = b64u(Buffer.from(JSON.stringify(payload), "utf8"));
  return `${body}.${sign(body, secret)}`;
}

export type VerifyResult =
  | { ok: true; claims: Payload }
  | { ok: false; reason: "malformed" | "bad-signature" | "expired" | "wrong-request" };

/**
 * Verify a token against the request it is being used for.
 *
 * The web layer does not call this — the ENGINE does, in Python. It exists here
 * so `serviceToken.test.ts` can prove the two implementations agree on the
 * signature, and so the binding property has a test that would fail loudly if
 * either side stopped checking it.
 */
export function verifyServiceToken(
  token: string,
  expected: { path: string; method: string },
  atMs: number = Date.now(),
  secret: string = serviceSecret()
): VerifyResult {
  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [body, mac] = parts;

  const want = Buffer.from(sign(body, secret));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) {
    return { ok: false, reason: "bad-signature" };
  }

  let claims: Payload;
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (typeof claims.exp !== "number" || claims.exp * 1000 < atMs) {
    return { ok: false, reason: "expired" };
  }

  const path = expected.path.replace(/^\/+|\/+$/g, "");
  if (claims.path !== path || claims.method !== expected.method.toUpperCase()) {
    return { ok: false, reason: "wrong-request" };
  }

  return { ok: true, claims };
}
