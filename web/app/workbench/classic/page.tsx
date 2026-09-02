import Workbench from "@/components/workbench/Workbench";

export const metadata = { title: "Classic cockpit — PRAHARI" };

/**
 * The original single-page cockpit, unchanged and always reachable.
 *
 * DEC-056 splits the workbench into ten routes; some analysts will prefer the
 * one-screen view, and the Phase 0 visual baseline is a picture of this page.
 * It is not a legacy stub -- it renders the same component /workbench does with
 * the flag off.
 */
export default function Page() {
  return <Workbench />;
}
