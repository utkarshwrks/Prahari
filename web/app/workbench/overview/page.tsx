import { redirect } from "next/navigation";
import { FEATURES } from "@/lib/features";
import Overview from "@/components/workspace/Overview";

export const metadata = { title: "Overview — PRAHARI" };

/**
 * The routed workspace's triage dashboard (DEC-056).
 *
 * It used to be what `/workbench` rendered. It now has its own route so that
 * the classic cockpit can be the default landing without either view having to
 * live behind a toggle that changes what a URL means.
 *
 * Gated on the flag, because `app/workbench/layout.tsx` only wraps children in
 * the workspace shell when the flag is on. Without this, a flag-off build --
 * which is what Render deploys today -- would serve this page with no rail, no
 * breadcrumbs and no way back: an orphan reachable only by typing its URL.
 */
export default function Page() {
  if (!FEATURES.workspaceRoutes) redirect("/workbench");
  return <Overview />;
}
