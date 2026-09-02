import { FEATURES } from "@/lib/features";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";

/**
 * The workspace shell, gated (DEC-056).
 *
 * With NEXT_PUBLIC_FF_WORKSPACE off this renders children bare, so `/workbench`
 * is byte-for-byte the single-page cockpit it has always been -- the prime
 * directive is additive only, and a layout that wrapped the legacy page in a
 * new rail would break that on the first deploy.
 *
 * The nested routes exist either way; with the flag off they render without the
 * shell rather than 404ing, which keeps a pasted deep link working.
 */
export default function WorkbenchLayout({ children }: { children: React.ReactNode }) {
  if (!FEATURES.workspaceRoutes) return <>{children}</>;
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
