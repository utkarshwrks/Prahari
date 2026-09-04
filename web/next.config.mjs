/** @type {import('next').NextConfig} */

/**
 * The workspace flag no longer needs a rewrite here (DEC-056, then DEC-076).
 *
 * It used to. `/workbench` had to be the Overview with the flag on and the
 * single-page cockpit with it off, and branching inside `app/workbench/page.tsx`
 * pulled BOTH components into the route bundle -- 256 kB first-load JS against
 * 103 kB, because the dead branch dragged the cockpit and three.js in with it.
 * A rewrite split them at the routing layer instead.
 *
 * The cockpit is now what `/workbench` renders in BOTH builds, and the Overview
 * has its own route at `/workbench/overview`, so the split is already at the
 * routing layer and neither build pays for the branch it does not use. The
 * rewrite has nothing left to do.
 *
 * It is REMOVED rather than left in place, because leaving it was an outage:
 * `/workbench` rewrote to `/workbench/classic`, which now redirects back to
 * `/workbench`, which rewrote again. Measured in a real flag-off build before
 * this was taken out: 173,751 navigations for one page load. The flag-on build
 * -- the only one exercised locally -- could never have shown it, because the
 * rewrite is empty when the flag is on.
 */
const nextConfig = {
  reactStrictMode: true,

  /**
   * The image optimizer is DISABLED (Phase 8 security pass).
   *
   * `npm audit` reports a high-severity DoS against Next's Image Optimization
   * endpoint on self-hosted applications, fixed only in Next 16 -- a major
   * framework migration this project is not doing inside a release gate.
   *
   * The endpoint is reachable on any self-hosted Next app whether or not
   * `next/image` is used, and this app uses it NOWHERE: the one image in the
   * tree is the TOTP enrolment QR, a server-generated data URI that an
   * optimiser must not touch anyway. Turning the optimizer off removes the
   * vulnerable route entirely rather than leaving it exposed and unused.
   *
   * Cost: `next/image` would render a plain <img> if anyone added one. That is
   * the correct trade for a surface we do not use.
   */
  images: { unoptimized: true },
};

export default nextConfig;
