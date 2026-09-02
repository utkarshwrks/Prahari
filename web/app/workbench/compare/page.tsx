"use client";

import { Suspense } from "react";
import CompareView from "@/components/workspace/CompareView";

export default function Page() {
  return (
    <Suspense fallback={<p className="mono p-4 text-[10px] text-[var(--muted-2)]">Loading…</p>}>
      <CompareView />
    </Suspense>
  );
}
