"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Leaflet touches `window`, so the map must be client-only (no SSR).
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="mono flex items-center gap-2 text-xs tracking-[0.2em] text-muted">
        <Loader2 className="h-4 w-4 animate-spin text-red-bright" />
        INITIALISING TACTICAL MAP…
      </div>
    </div>
  ),
});

export default function MapPanel() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapView />
      <div className="pointer-events-none absolute inset-0 z-[500] shadow-[inset_0_0_60px_rgba(0,0,0,0.6)]" />
    </div>
  );
}
