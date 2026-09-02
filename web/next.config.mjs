/** @type {import('next').NextConfig} */

/**
 * The workspace flag is read here as well as in `lib/features.ts` (DEC-056).
 *
 * `/workbench` must be the Overview when the flag is on and the original
 * single-page cockpit when it is off. Expressing that as a branch inside
 * `app/workbench/page.tsx` meant BOTH components entered the route's bundle --
 * measured at 256 kB first-load JS against 103 kB for the Overview alone,
 * because the dead branch dragged the cockpit and three.js in with it. A
 * dynamic import did not help: Next's client-reference graph includes both.
 *
 * A rewrite splits them at the routing layer instead. The URL the analyst sees
 * is unchanged, the cockpit served is byte-for-byte the same component, and
 * neither build pays for the branch it does not use.
 */
const WORKSPACE_ON = process.env.NEXT_PUBLIC_FF_WORKSPACE === "1";

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Flag off: /workbench serves the classic cockpit, exactly as before.
    //
    // `beforeFiles`, not the default bare array. A bare array is `afterFiles`,
    // which only applies when NO page matched -- and `app/workbench/page.tsx`
    // always matches, so the rewrite silently never fired and the flag-off
    // build served the Overview. Caught by running the journey against a
    // flag-off build; nothing in the flag-on gate could have found it.
    return {
      beforeFiles: WORKSPACE_ON
        ? []
        : [{ source: "/workbench", destination: "/workbench/classic" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
