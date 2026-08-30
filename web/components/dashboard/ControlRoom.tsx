"use client";

import { useEffect } from "react";
import { useIntel } from "@/store/intel";
import DashboardHeader from "./DashboardHeader";
import ThreatHUD from "./ThreatHUD";
import HeaderControls from "./HeaderControls";
import BreachToaster from "./BreachToaster";
import TourGuide from "./TourGuide";
import TacticalPanel from "../ui/TacticalPanel";
import LiveIntelFeed from "./panels/LiveIntelFeed";
import MapPanel from "./MapPanel";
import ThreatAnalytics from "./panels/ThreatAnalytics";
import JabalpurZoneMonitor from "./panels/JabalpurZoneMonitor";
import WalletTracker from "./panels/WalletTracker";
import AlertLog from "./panels/AlertLog";
import LiveNERAnalyzer from "./panels/LiveNERAnalyzer";

export default function ControlRoom() {
  const start = useIntel((s) => s.start);
  const stop = useIntel((s) => s.stop);
  const total = useIntel((s) => s.totalIntercepts);
  const breaches = useIntel((s) => s.geofenceBreaches);
  const mode = useIntel((s) => s.mode);
  const datasetNotice = useIntel((s) => s.datasetNotice);
  const liveStatus = useIntel((s) => s.liveStatus);

  useEffect(() => {
    start();
    return () => stop();
  }, [start, stop]);

  return (
    <div className="relative z-10 flex h-screen flex-col overflow-x-hidden">
      <DashboardHeader />
      <BreachToaster />
      <TourGuide />

      {/* mobile threat bar — carries the threat HUD + demo/mute controls that
          don't fit in the header on small screens */}
      <div className="flex items-center justify-between gap-2 border-b border-border bg-panel/50 px-3 py-2 md:hidden">
        <ThreatHUD />
        <HeaderControls />
      </div>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-x-hidden overflow-y-auto p-2 xl:grid-cols-[360px_1fr_392px] xl:overflow-hidden">
        {/* LEFT — Live Intel Feed */}
        <TacticalPanel
          title="Live Intel Feed"
          live
          tourId="feed"
          className="min-h-[520px] min-w-0 xl:min-h-0"
          right={
            <div className="flex items-center gap-2">
              <span
                className={`mono border px-1.5 py-0.5 text-[8px] uppercase tracking-wider ${
                  mode === "DEMO" || liveStatus === "live"
                    ? "border-red/40 bg-red/10 text-red-bright"
                    : liveStatus === "offline"
                      ? "border-border-2 text-muted-2"
                      : "border-border-2 text-muted"
                }`}
                title={
                  mode === "DEMO"
                    ? "Synthetic demo feed"
                    : mode === "DATASET"
                      ? (datasetNotice ?? "Real listings from the engine")
                      : "Real public OSINT feed"
                }
              >
                {mode === "DEMO"
                  ? "DEMO"
                  : liveStatus === "offline"
                    ? (mode === "DATASET" ? "ENGINE OFFLINE" : "OFFLINE")
                    : liveStatus === "live"
                      ? (mode === "DATASET" ? "DATASET" : "LIVE OSINT")
                      : "CONNECTING"}
              </span>
              <span className="mono text-[10px] tracking-widest text-muted-2">{total} RX</span>
            </div>
          }
        >
          <LiveIntelFeed />
        </TacticalPanel>

        {/* CENTER — Geospatial Command + NER analyzer */}
        <div className="flex min-h-0 min-w-0 flex-col gap-2">
          <TacticalPanel
            title="Geospatial Command"
            live
            tourId="map"
            bodyClassName="relative"
            className="min-h-[420px] flex-1"
            right={
              <span className={`mono text-[10px] tracking-widest ${breaches > 0 ? "text-red-bright" : "text-muted-2"}`}>
                {breaches} BREACH{breaches === 1 ? "" : "ES"}
              </span>
            }
          >
            <MapPanel />
          </TacticalPanel>
          <div className="shrink-0" data-tour="ner">
            <LiveNERAnalyzer />
          </div>
        </div>

        {/* RIGHT — analytics stack. Each panel is shrink-0 so the column
            SCROLLS instead of flexbox squashing panels into each other. */}
        <div className="slim-scroll flex min-h-0 min-w-0 flex-col gap-2 xl:overflow-y-auto xl:pr-0.5">
          <div data-tour="analytics" className="shrink-0">
            <ThreatAnalytics />
          </div>
          <div className="shrink-0">
            <JabalpurZoneMonitor />
          </div>
          <div className="shrink-0">
            <WalletTracker />
          </div>
          <div className="shrink-0">
            <AlertLog />
          </div>
        </div>
      </main>
    </div>
  );
}
