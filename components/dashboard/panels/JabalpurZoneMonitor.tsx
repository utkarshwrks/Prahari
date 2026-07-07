"use client";

import { Crosshair, AtSign } from "lucide-react";
import { useIntel } from "@/store/intel";
import { handleWatch } from "@/lib/analytics";
import { relativeTime } from "@/lib/time";
import TacticalPanel from "../../ui/TacticalPanel";

const NEIGHBOURS = ["Katni", "Narsinghpur"];

export default function JabalpurZoneMonitor() {
  const threat = useIntel((s) => s.threatLevel);
  const breaches = useIntel((s) => s.geofenceBreaches);
  const cityHeat = useIntel((s) => s.cityHeat);
  const alertLog = useIntel((s) => s.alertLog);
  const intercepts = useIntel((s) => s.intercepts);
  const registerCities = useIntel((s) => s.registerCities);
  const focusOnCity = useIntel((s) => s.focusOnCity);
  const ping = (city?: string | null) => {
    if (!city) return;
    registerCities([city], "analysis");
    focusOnCity(city);
  };

  const handles = handleWatch(intercepts, 4);
  const latest = alertLog.slice(0, 4);

  const zoneColor =
    threat === "CRITICAL" ? "text-red-bright" : threat === "ELEVATED" ? "text-red-deep" : "text-muted";

  return (
    <TacticalPanel title="Jabalpur Zone Monitor" live>
      <div className="space-y-3 p-3">
        {/* zone level + count */}
        <div className="grid grid-cols-2 gap-2">
          <div className="border border-border bg-panel-2/50 px-3 py-2">
            <div className="mono text-[9px] uppercase tracking-[0.16em] text-muted-2">
              Zone Level
            </div>
            <div className={`mono mt-0.5 text-sm font-bold uppercase tracking-wide ${zoneColor}`}>
              {threat}
            </div>
          </div>
          <div className="border border-border bg-panel-2/50 px-3 py-2">
            <div className="mono text-[9px] uppercase tracking-[0.16em] text-muted-2">
              In-Zone Hits
            </div>
            <div className="mono mt-0.5 text-sm font-bold text-red-bright">
              {breaches}
            </div>
          </div>
        </div>

        {/* neighbour ring */}
        <div>
          <div className="label mb-1.5">Neighbour Ring</div>
          <div className="grid grid-cols-2 gap-2">
            {NEIGHBOURS.map((n) => {
              const heat = cityHeat[n] ?? 0;
              return (
                <button
                  key={n}
                  onClick={() => ping(n)}
                  title={`Ping ${n} on map`}
                  className={`flex items-center justify-between border px-2.5 py-1.5 transition hover:border-red/60 ${
                    heat > 0 ? "border-red/40 bg-red/[0.06]" : "border-border bg-panel-2/40"
                  }`}
                >
                  <span className="mono text-[11px] text-text">{n}</span>
                  <span className={`mono text-[10px] ${heat > 0 ? "text-red-bright" : "text-muted-2"}`}>
                    {heat > 0 ? `HEAT ${heat}` : "CLEAR"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* latest in-zone breaches */}
        <div>
          <div className="label mb-1.5">Latest In-Zone Breaches</div>
          <div className="space-y-1">
            {latest.length === 0 && (
              <div className="mono text-[10px] text-muted-2">— none yet —</div>
            )}
            {latest.map((a) => (
              <button
                key={a.id}
                onClick={() => ping(a.city)}
                title={`Ping ${a.city} on map`}
                className="flex w-full items-center justify-between gap-2 border-l-2 border-red/60 bg-panel-2/30 px-2 py-1 transition hover:bg-panel-2/60"
              >
                <span className="mono flex items-center gap-1.5 text-[11px] text-text">
                  <Crosshair className="h-3 w-3 text-red-bright" />
                  {a.city}
                </span>
                <span className="mono text-[9px] text-muted-2">
                  {a.source} · {relativeTime(a.timestamp)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* local handle watchlist */}
        <div>
          <div className="label mb-1.5">Handle Watchlist</div>
          <div className="space-y-1">
            {handles.length === 0 && (
              <div className="mono text-[10px] text-muted-2">— none flagged —</div>
            )}
            {handles.map((h) => (
              <button
                key={h.handle}
                onClick={() => ping(h.lastCity)}
                title={h.lastCity ? `Ping ${h.lastCity} on map` : undefined}
                className="flex w-full items-center justify-between gap-2 transition hover:text-text"
              >
                <span className="mono flex items-center gap-1 truncate text-[11px] text-text">
                  <AtSign className="h-3 w-3 text-muted" />
                  {h.handle.replace(/^@/, "")}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  {h.lastCity && (
                    <span className="mono text-[9px] text-muted-2">{h.lastCity}</span>
                  )}
                  <span className="mono border border-border px-1 text-[9px] text-muted">
                    ×{h.count}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </TacticalPanel>
  );
}
