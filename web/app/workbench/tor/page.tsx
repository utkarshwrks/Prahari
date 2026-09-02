"use client";

import TimingPanel from "@/components/workbench/TimingPanel";

/** The Tor timing lab: experiment history and a live run. */
export default function Page() {
  return (
    <div className="glass">
      <TimingPanel />
    </div>
  );
}
