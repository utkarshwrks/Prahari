import Overview from "@/components/workspace/Overview";

export const metadata = { title: "Overview — PRAHARI" };

/**
 * The routed workspace's triage dashboard (DEC-056).
 *
 * It used to be what `/workbench` rendered. It now has its own route so that
 * the classic cockpit can be the default landing without either view having to
 * live behind a toggle that changes what a URL means.
 */
export default function Page() {
  return <Overview />;
}
