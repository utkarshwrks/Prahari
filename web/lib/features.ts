/**
 * Server-readable, client-safe feature flags for the v2.1 upgrade.
 *
 * Every new surface built in Phases 2-5 renders behind one of these. Each
 * defaults OFF and is only switched on after its phase gate passes, so the
 * legacy surface stays reachable at all times (the prime directive: additive
 * only, nothing that works today may stop working).
 *
 * These are NEXT_PUBLIC_ by necessity -- the flag has to be readable in the
 * client bundle to decide which tree renders. That is safe: a flag name is not
 * a secret. ENGINE_URL, API keys and private keys stay server-only (INV-2) and
 * must never gain a NEXT_PUBLIC_ prefix.
 *
 * Read at module scope, not per call: Next.js inlines NEXT_PUBLIC_ vars at
 * build time, so these are constants in the built output and tree-shake the
 * dead branch away.
 */
export const FEATURES = {
  /** Phase 2 -- routed analyst workspace under /workbench/*. */
  workspaceRoutes: process.env.NEXT_PUBLIC_FF_WORKSPACE === "1",
  /** Phase 3 -- the graph intelligence lab. */
  graphLab: process.env.NEXT_PUBLIC_FF_GRAPH_LAB === "1",
  /** Phase 4 -- the Command Panel (management, CRUD, reports, analytics). */
  commandPanel: process.env.NEXT_PUBLIC_FF_COMMAND === "1",
  /** Phase 5 -- SANGAM Pro layers and the three-class coordinate model. */
  sangamPro: process.env.NEXT_PUBLIC_FF_SANGAM_PRO === "1",
} as const;

export type FeatureName = keyof typeof FEATURES;
