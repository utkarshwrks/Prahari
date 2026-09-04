import { redirect } from "next/navigation";

/**
 * Kept as a redirect, not deleted.
 *
 * The classic cockpit now lives at `/workbench` itself. This path was linked
 * from the rail, the command palette and anything an analyst bookmarked while
 * it was the escape hatch, so it forwards rather than 404s.
 */
export default function Page() {
  redirect("/workbench");
}
