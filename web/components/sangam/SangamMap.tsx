"use client";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoNode } from "@/lib/geoderive";
import { centroid, haversineKm } from "@/lib/geoderive";

/**
 * The SANGAM map — an actor's footprints in the world (WHERE), each a click from
 * its attribution (WHO). Genuine geolocation where a host resolves; a geofence
 * ring for the operational zone. Premium HTML markers (pulse + glow), reach lines
 * to the centroid, and a dark basemap from key-free OSM tiles.
 */

const cssVar = (n: string, f: string) =>
  (typeof window !== "undefined" && getComputedStyle(document.documentElement).getPropertyValue(n).trim()) || f;

const KIND_FALLBACK: Record<GeoNode["kind"], string> = {
  market: "#e8503a", infra: "#9b7fd8", offramp: "#d9a441", actor: "#e8503a",
};

function pin(color: string, kind: GeoNode["kind"], real: boolean) {
  const size = kind === "market" ? 20 : kind === "offramp" ? 18 : 16;
  return L.divIcon({
    className: "",
    html: `<span class="sg-pin ${real ? "sg-real" : "sg-inf"}" style="--c:${color};width:${size}px;height:${size}px"><i></i></span>`,
    iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2],
  });
}

function core(color: string) {
  return L.divIcon({
    className: "",
    html: `<span class="sg-core" style="--c:${color}"><i></i></span>`,
    iconSize: [26, 26], iconAnchor: [13, 13],
  });
}

/** Fit the map to the actor's footprints whenever they change. */
function FitBounds({ nodes, center }: { nodes: GeoNode[]; center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (!nodes.length) { map.setView(center, 2); return; }
    const b = L.latLngBounds(nodes.map((n) => [n.lat, n.lng] as [number, number]).concat([center]));
    map.fitBounds(b.pad(0.35), { animate: true, maxZoom: 5 });
  }, [nodes, center, map]);
  return null;
}

export default function SangamMap({
  nodes, zoneKm, onPick, picked,
}: { nodes: GeoNode[]; zoneKm: number; onPick: (n: GeoNode) => void; picked: GeoNode | null }) {
  const [pal, setPal] = useState({ accent: "#e8503a", accent2: "#d9a441" });
  useEffect(() => { setPal({ accent: cssVar("--accent", "#e8503a"), accent2: cssVar("--accent-2", "#d9a441") }); }, [nodes]);

  const color = (k: GeoNode["kind"]) => (k === "infra" ? "#9b7fd8" : k === "offramp" ? pal.accent2 : pal.accent) || KIND_FALLBACK[k];
  const center = useMemo(() => centroid(nodes), [nodes]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)]">
      <MapContainer center={center} zoom={2} minZoom={2} worldCopyJump
        style={{ height: "100%", width: "100%", background: "var(--bg-2)" }}
        attributionControl={false} zoomControl={false} scrollWheelZoom>
        <TileLayer className="sangam-dark" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBounds nodes={nodes} center={center} />

        {/* reach lines from centroid to each footprint */}
        {nodes.map((n) => (
          <Polyline key={"l" + n.id} positions={[center, [n.lat, n.lng]]}
            pathOptions={{ color: color(n.kind), weight: picked?.id === n.id ? 1.6 : 0.8, opacity: picked?.id === n.id ? 0.7 : 0.22 }} />
        ))}

        {/* geofence ring */}
        <Circle center={center} radius={zoneKm * 1000}
          pathOptions={{ color: pal.accent, weight: 1.2, opacity: 0.55, fillColor: pal.accent, fillOpacity: 0.04, dashArray: "4 7" }} />

        {/* footprint markers */}
        {nodes.map((n) => {
          const inZone = haversineKm(center, [n.lat, n.lng]) <= zoneKm;
          const c = color(n.kind);
          return (
            <Marker key={n.id} position={[n.lat, n.lng]} icon={pin(c, n.kind, !n.inferred)}
              eventHandlers={{ click: () => onPick(n) }}>
              <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                <span style={{ fontFamily: "monospace", fontSize: 11 }}>{n.label}</span>
              </Tooltip>
              <Popup>
                <div style={{ fontFamily: "monospace", fontSize: 11, maxWidth: 240, lineHeight: 1.5 }}>
                  <b style={{ color: c }}>{n.kind.toUpperCase()}</b> {n.flag ?? ""}<br />
                  <b>{n.label}</b><br />
                  {n.ip && <span>{n.city ? `${n.city}, ` : ""}{n.country} · {n.ip}<br /></span>}
                  {n.asn && <span>AS{n.asn} {n.org}<br /></span>}
                  <span style={{ opacity: 0.7 }}>
                    {haversineKm(center, [n.lat, n.lng]).toLocaleString()} km · {inZone ? "in zone" : "outside zone"} · {n.inferred ? "inferred" : "resolved"}
                  </span>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* the actor's activity centroid */}
        <Marker position={center} icon={core(pal.accent)}>
          <Tooltip permanent direction="right" offset={[10, 0]} opacity={0.9}>
            <span style={{ fontFamily: "monospace", fontSize: 10 }}>activity centroid</span>
          </Tooltip>
        </Marker>
      </MapContainer>

      <style>{`
        .sangam-dark { filter: invert(1) hue-rotate(180deg) brightness(0.7) contrast(0.95) saturate(0.5); }
        .leaflet-container { font-family: var(--font-mono), monospace; background: var(--bg-2); }
        .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: var(--surface); color: var(--text); border: 1px solid var(--border-2); box-shadow: 0 8px 30px rgba(0,0,0,.5); }
        .leaflet-tooltip { background: color-mix(in srgb, var(--surface) 92%, transparent); color: var(--text); border: 1px solid var(--border-2); box-shadow: none; }
        .leaflet-tooltip-top:before { border-top-color: var(--border-2); }
        .leaflet-tooltip-right:before { border-right-color: var(--border-2); }
        .sg-pin { position: relative; display: block; }
        .sg-pin i { position: absolute; inset: 30%; border-radius: 50%; background: var(--c); box-shadow: 0 0 10px var(--c), 0 0 3px var(--c); }
        .sg-pin:before { content: ""; position: absolute; inset: 0; border-radius: 50%; border: 1.5px solid var(--c); opacity: .6; animation: sgpulse 2.4s ease-out infinite; }
        .sg-inf i { opacity: .55; box-shadow: 0 0 6px var(--c); }
        .sg-inf:before { border-style: dashed; opacity: .4; }
        .sg-core { position: relative; display: block; width: 26px; height: 26px; }
        .sg-core i { position: absolute; inset: 34%; border-radius: 50%; background: #fff; box-shadow: 0 0 12px var(--c); }
        .sg-core:before { content: ""; position: absolute; inset: 0; border-radius: 50%; border: 2px solid var(--c); animation: sgpulse 2.4s ease-out infinite; }
        @keyframes sgpulse { 0% { transform: scale(.5); opacity: .8; } 100% { transform: scale(1.7); opacity: 0; } }
        @media (prefers-reduced-motion: reduce){ .sg-pin:before,.sg-core:before{ animation: none; } }
      `}</style>
    </div>
  );
}
