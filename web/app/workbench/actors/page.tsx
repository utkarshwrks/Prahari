"use client";

import { Suspense } from "react";
import ActorsTable from "@/components/workspace/ActorsTable";

export default function Page() {
  // useSearchParams needs a Suspense boundary to keep the route statically
  // renderable; without it Next bails the whole segment to client rendering.
  return (
    <Suspense
      fallback={<p className="mono p-4 text-[10px] text-[var(--muted-2)]">Loading actors…</p>}
    >
      <ActorsTable />
    </Suspense>
  );
}
