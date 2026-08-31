"use client";

import { useEffect, useMemo, useState } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoNode } from "@/lib/geoderive";
import { centroid, haversineKm } from "@/lib/geoderive";

/**
 * The SANGAM map: an actor's footprints placed in the world (WHERE), each point
 * a click away from its attribution (WHO). A geofence ring around the activity
 * centroid marks the operational zone — v1's idea, on v2's data. Dark basemap
 * via a CSS filter over free OSM tiles, so no key and no watermark.
 */

const cssVar = (n: string, f: string) =>
  (typeof window !== "undefined" && getComputedStyle(document.documentElement).getPropertyValue(n).trim()) || f;

export default function SangamMap({
  nodes, zoneKm, onPick,
}: { nodes: GeoNode[]; zoneKm: number; onPick: (n: GeoNode) => void }) {
  const [pal, setPal] = useState({ accent: "#e8503a", accent2: "#d9a441" });
  useEffect(() => { setPal({ accent: cssVar("--accent", "#e8503a"), accent2: cssVar("--accent-2", "#d9a441") }); }, []);

  const color = (k: GeoNode["kind"]) =>
    k === "infra" ? "#9b7fd8" : k === "offramp" ? pal.accent2 : pal.accent;
  const radius = (k: GeoNode["kind"]) => (k === "market" ? 9 : k === "offramp" ? 8 : 6);

  const center = useMemo(() => centroid(nodes), [nodes]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
      <MapContainer center={center} zoom={2} minZoom={2} worldCopyJump
        style={{ height: "100%", width: "100%", background: "var(--bg-2)" }}
        attributionControl={false} zoomControl={false} scrollWheelZoom>
        <TileLayer className="sangam-dark" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* geofence ring — the operational zone */}
        <Circle center={center} radius={zoneKm * 1000}
          pathOptions={{ color: pal.accent, weight: 1, opacity: 0.5, fillColor: pal.accent, fillOpacity: 0.05, dashArray: "5 6" }} />

        {nodes.map((n) => {
          const inZone = haversineKm(center, [n.lat, n.lng]) <= zoneKm;
          const c = color(n.kind);
          return (
            <CircleMarker key={n.id} center={[n.lat, n.lng]} radius={radius(n.kind)}
              pathOptions={{ color: c, weight: 2, fillColor: c, fillOpacity: inZone ? 0.85 : 0.35 }}
              eventHandlers={{ click: () => onPick(n) }}>
              <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                <span style={{ fontFamily: "monospace", fontSize: 11 }}>{n.label}</span>
              </Tooltip>
              <Popup>
                <div style={{ fontFamily: "monospace", fontSize: 11, maxWidth: 220 }}>
                  <b style={{ color: c }}>{n.kind.toUpperCase()}</b><br />
                  <b>{n.label}</b><br />
                  {n.detail}<br />
                  <span style={{ opacity: 0.7 }}>
                    {haversineKm(center, [n.lat, n.lng]).toLocaleString()} km from centroid · {inZone ? "in zone" : "outside zone"}
                    {n.inferred ? " · inferred location" : ""}
                  </span>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* the actor centroid marker */}
        <CircleMarker center={center} radius={5}
          pathOptions={{ color: pal.accent, weight: 2, fillColor: "#fff", fillOpacity: 0.9 }}>
          <Tooltip permanent direction="right" offset={[8, 0]} opacity={0.9}>
            <span style={{ fontFamily: "monospace", fontSize: 10 }}>activity centroid</span>
          </Tooltip>
        </CircleMarker>
      </MapContainer>

      <style>{`
        .sangam-dark { filter: invert(1) hue-rotate(180deg) brightness(0.72) contrast(0.95) saturate(0.55); }
        .leaflet-container { font-family: var(--font-mono), monospace; }
        .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: var(--surface); color: var(--text); border: 1px solid var(--border-2); }
        .leaflet-tooltip { background: var(--surface); color: var(--text); border: 1px solid var(--border-2); }
        .leaflet-tooltip-top:before { border-top-color: var(--border-2); }
        .leaflet-bar a { background: var(--surface); color: var(--text); border-color: var(--border-2); }
      `}</style>
    </div>
  );
}
