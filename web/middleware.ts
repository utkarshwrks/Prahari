import { withAuth } from "next-auth/middleware";
import { AUTH_SECRET, SIGNIN_PAGE } from "@/lib/authConfig";

export default withAuth({ secret: AUTH_SECRET, pages: { signIn: SIGNIN_PAGE } });

export const config = { matcher: ["/workbench/:path*"] };
