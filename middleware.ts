import { withAuth } from "next-auth/middleware";
import { AUTH_SECRET, SIGNIN_PAGE } from "@/lib/authConfig";

// Protects /dashboard — unauthenticated requests redirect to /login.
export default withAuth({
  secret: AUTH_SECRET,
  pages: { signIn: SIGNIN_PAGE },
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
