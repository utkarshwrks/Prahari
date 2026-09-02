import { withAuth } from "next-auth/middleware";
import { AUTH_SECRET, SIGNIN_PAGE } from "@/lib/authConfig";

/**
 * Route-level guard.
 *
 * `/command` is added in DEC-058 as a ROUTE guard, not as the authorisation
 * control. It runs on the Edge runtime, which cannot read the in-process
 * step-up store or the session registry, so all it can honestly do is refuse
 * traffic with no session at all — and that is all it is asked to do.
 *
 * The control is `lib/adminGuard.ts`, on the Node side, plus the engine's own
 * independent check. If this were the only layer, a hand-rolled `fetch` from a
 * browser console would be enough to reach every mutation.
 */
export default withAuth({ secret: AUTH_SECRET, pages: { signIn: SIGNIN_PAGE } });

export const config = {
  matcher: ["/workbench/:path*", "/sangam/:path*", "/command/:path*"],
};
