import Workbench from "@/components/workbench/Workbench";

export const metadata = { title: "Workbench — PRAHARI" };

/**
 * `/workbench` is the classic single-page cockpit, and therefore what an
 * analyst lands on after signing in.
 *
 * DEC-056 split the workbench into ten routes and made the triage dashboard the
 * default. That inverted what most analysts actually want on arrival: the
 * one-screen cockpit where the rail, the graph and the proof drawer are all
 * visible at once. The routed workspace is not withdrawn -- it moved to
 * `/workbench/overview` and is one click away from the header -- but it is now
 * opt-in rather than the thing you have to escape from.
 *
 * The route, not a stored preference, carries the choice. A preference in
 * localStorage would make the same URL render two different screens for two
 * people, which is precisely what breaks a pasted link during a handover.
 */
export default function Page() {
  return <Workbench />;
}
