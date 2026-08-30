// Edge-safe auth constants shared by both the NextAuth route handler (Node)
// and middleware (Edge). No Node-only imports here (no fs / bcrypt), so this
// module is safe to import from middleware.ts.

// A default secret keeps the app zero-config for `npm install && npm run dev`.
// Override in production via the NEXTAUTH_SECRET env var.
export const AUTH_SECRET =
  process.env.NEXTAUTH_SECRET ||
  "prahari-local-development-secret-do-not-use-in-production-8f3a";

export const SIGNIN_PAGE = "/login";
