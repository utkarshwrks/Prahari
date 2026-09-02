import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyCredentials } from "./users";
import { AUTH_SECRET, SIGNIN_PAGE } from "./authConfig";
import { rateLimit } from "./rateLimit";
import {
  ABSOLUTE_SESSION_SECONDS, JWT_TTL_SECONDS, check as checkSession, newSessionId, register,
} from "./sessions";
import { revokeStepUp } from "./totp";

/**
 * Whether cookies may carry the `Secure` attribute.
 *
 * True only when the app is actually served over HTTPS. `NEXTAUTH_URL` is the
 * authoritative statement of how the app is reached; `IS_PRODUCTION` is not,
 * because a production build is routinely served over http during a local run
 * or behind a proxy that terminates TLS elsewhere.
 */
const USE_SECURE_COOKIES = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");

// Credential login is the brute-force surface. Ten attempts per account per
// fifteen minutes: invisible to a real officer, fatal to a password spray.
// Keyed by email rather than IP so a distributed attack on ONE account is
// still throttled -- the thing actually worth protecting is the account.
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export const authOptions: NextAuthOptions = {
  secret: AUTH_SECRET,
  /**
   * Short JWT with rotation, capped absolutely (DEC-059).
   *
   * `maxAge` is the absolute cap -- eight hours, one shift. `updateAge` rotates
   * the token every fifteen minutes, so a leaked token stops working long
   * before the session itself would have expired.
   */
  session: {
    strategy: "jwt",
    maxAge: ABSOLUTE_SESSION_SECONDS,
    updateAge: JWT_TTL_SECONDS,
  },
  jwt: { maxAge: ABSOLUTE_SESSION_SECONDS },
  cookies: {
    sessionToken: {
      /**
       * `Secure` follows the URL SCHEME, not NODE_ENV (DEC-059).
       *
       * Keying it to NODE_ENV looks right and is wrong: `next start` sets
       * NODE_ENV=production, so a production build served over plain HTTP --
       * which is every local run, every CI run and the first boot of a new
       * deployment before TLS is in front of it -- marked the cookie Secure,
       * the browser dropped it, and login silently bounced back to /login in a
       * redirect loop. Found by running the browser journey against a
       * production build.
       *
       * The `__Secure-` name prefix is tied to the same value: browsers reject
       * that prefix on a cookie that is not Secure, so the two must agree.
       */
      name: USE_SECURE_COOKIES ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: USE_SECURE_COOKIES,
      },
    },
  },
  pages: {
    signIn: SIGNIN_PAGE,
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const key = `login:${credentials.email.toLowerCase().trim()}`;
        if (!rateLimit(key, LOGIN_LIMIT, LOGIN_WINDOW_MS).ok) {
          // Same null return as a wrong password: distinguishing "throttled"
          // from "wrong password" tells an attacker which accounts exist.
          return null;
        }

        const user = await verifyCredentials(
          credentials.email,
          credentials.password
        );
        if (!user) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role?: string }).role;

        /**
         * Mint a session id and register it (DEC-059).
         *
         * The JWT proves WHO; the registry proves the session is still live.
         * Without the second half, revocation and the absolute cap would both
         * be advisory -- a signed token would keep working until it expired on
         * its own, which is exactly what a revocation list exists to prevent.
         */
        const sid = newSessionId();
        token.sid = sid;
        register({
          id: sid,
          userId: String(token.id ?? ""),
          email: String(token.email ?? ""),
          role: String(token.role ?? ""),
          userAgent: "",
          ip: "",
        });
      }

      /**
       * On every rotation, re-check the registry.
       *
       * A role change or a password reset revokes the user's sessions; this is
       * where that takes effect. Clearing `sid` rather than throwing keeps the
       * failure graceful -- the guard treats a token with no sid as no session
       * and asks for a fresh sign-in, which is the right recovery path.
       */
      if (trigger === "update" || !user) {
        const sid = typeof token.sid === "string" ? token.sid : null;
        if (sid && !checkSession(sid).valid) {
          revokeStepUp(sid);
          delete token.sid;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        // The session id is needed client-side only to mint the CSRF header;
        // it is already in the httpOnly cookie, so exposing it here grants
        // nothing a same-origin script did not already have.
        (session.user as { sid?: string }).sid = token.sid as string;
      }
      return session;
    },
  },
};
