import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyCredentials } from "./users";
import { AUTH_SECRET, SIGNIN_PAGE } from "./authConfig";
import { rateLimit } from "./rateLimit";

// Credential login is the brute-force surface. Ten attempts per account per
// fifteen minutes: invisible to a real officer, fatal to a password spray.
// Keyed by email rather than IP so a distributed attack on ONE account is
// still throttled -- the thing actually worth protecting is the account.
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export const authOptions: NextAuthOptions = {
  secret: AUTH_SECRET,
  session: { strategy: "jwt" },
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
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
};
