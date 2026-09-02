"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { DERIVED, RESOLVED, type ClassifiedPoint } from "@/lib/sangamClass";

/**
 * The Leaflet layer for SANGAM Pro (DEC-061).
 *
 * Split out so `SangamProMap` can compute clusters and decide on reduced motion
 * without pulling Leaflet into the page bundle — the map stays behind a
 * `dynamic()` boundary, as the 3D graph does.
 */

interface Cluster {
  lat: number;
  lng: number;
  members: ClassifiedPoint[];
}

/**
 * The marker.
 *
 * `sg2-resolved` is a filled disc; `sg2-derived` is a hollow disc with a DASHED
 * border. The dash is the load-bearing detail: it survives greyscale, it
 * survives a colour-blind reader, and it is the same visual grammar the legend
 * uses.
 */
function icon(cls: string, count: number, isSelected: boolean, reduced: boolean): L.DivIcon {
  const size = cls === RESOLVED ? 18 : 20;
  const badge =
    count > 1
      ? `<b class="sg2-count">${count}</b>`
      : "";
  return L.divIcon({
    className: "",
    html:
      `<span class="sg2 sg2-${cls}${isSelected ? " sg2-sel" : ""}${reduced ? " sg2-still" : ""}" ` +
      `style="width:${size}px;height:${size}px"><i></i>${badge}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function Fit({ clusters }: { clusters: Cluster[] }) {
  const map = useMap();
  useEffect(() => {
    if (!clusters.length) return;
    const b = L.latLngBounds(clusters.map((c) => [c.lat, c.lng] as [number, number]));
    map.fitBounds(b.pad(0.4), { animate: false, maxZoom: 6 });
  }, [clusters, map]);
  return null;
}

export default function LeafletCanvas({
  clusters, selected, onSelect, onTileError, reducedMotion,
}: {
  clusters: Cluster[];
  points: ClassifiedPoint[];
  selected: ClassifiedPoint | null;
  compareWith: ClassifiedPoint | null;
  onSelect: (p: ClassifiedPoint) => void;
  onTileError: () => void;
  reducedMotion: boolean;
}) {
  const centre = useMemo<[number, number]>(() => {
    if (!clusters.length) return [20, 0];
    return [
      clusters.reduce((s, c) => s + c.lat, 0) / clusters.length,
      clusters.reduce((s, c) => s + c.lng, 0) / clusters.length,
    ];
  }, [clusters]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapContainer
        center={centre}
        zoom={2}
        minZoom={2}
        worldCopyJump
        style={{ height: "100%", width: "100%", background: "var(--bg-2)" }}
        attributionControl={false}
        zoomControl={false}
        scrollWheelZoom
      >
        {/*
          A tile failure is STATED, not left as a blank grey rectangle that
          looks like a bug. `eventHandlers.tileerror` tells the parent, which
          renders the banner; the graticule below stays visible either way, so
          the points are still readable without a basemap.
        */}
        <TileLayer
          className="sangam-dark"
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{ tileerror: onTileError }}
        />
        <Fit clusters={clusters} />

        {clusters.map((c) => {
          // A cluster's class is its strongest claim: if any member is a
          // measured point, the marker is solid. Drawing a derived shape over a
          // resolved fact would understate the evidence.
          const cls = c.members.some((m) => m.class === RESOLVED) ? RESOLVED : DERIVED;
          const head = c.members[0];
          const isSel = Boolean(selected && c.members.some((m) => m.host === selected.host));
          return (
            <Marker
              key={`${c.lat},${c.lng}`}
              position={[c.lat, c.lng]}
              icon={icon(cls, c.members.length, isSel, reducedMotion)}
              eventHandlers={{ click: () => onSelect(head) }}
              alt={`${head.host}, ${cls}`}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                <span style={{ fontFamily: "monospace", fontSize: 11 }}>
                  {c.members.length > 1
                    ? `${c.members.length} hosts at this exact coordinate`
                    : head.host}
                  {" · "}
                  {cls}
                </span>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>

      <style>{`
        .sangam-dark { filter: invert(1) hue-rotate(180deg) brightness(0.7) contrast(0.95) saturate(0.5); }
        .leaflet-container { font-family: var(--font-mono), monospace; background: var(--bg-2);
          /* The graticule: visible when tiles fail, so a missing basemap does
             not read as a broken page. */
          background-image:
            linear-gradient(var(--grid) 1px, transparent 1px),
            linear-gradient(90deg, var(--grid) 1px, transparent 1px);
          background-size: 60px 60px; }
        .leaflet-tooltip { background: color-mix(in srgb, var(--surface) 94%, transparent);
          color: var(--text); border: 1px solid var(--border-2); box-shadow: none; }
        .leaflet-tooltip-top:before { border-top-color: var(--border-2); }

        .sg2 { position: relative; display: block; }
        .sg2 i { position: absolute; inset: 0; border-radius: 50%; }

        /* RESOLVED — a solid, filled disc. A measured fact. */
        .sg2-resolved i { background: var(--c-high); border: 1.5px solid var(--c-high);
          box-shadow: 0 0 10px color-mix(in srgb, var(--c-high) 60%, transparent); }

        /* DERIVED — hollow, with a DASHED ring. Legible in greyscale, and
           deliberately quieter than a measured point. */
        .sg2-derived i { background: transparent; border: 1.5px dashed var(--muted);
          box-shadow: none; }
        .sg2-derived:after { content: ""; position: absolute; inset: -4px; border-radius: 50%;
          border: 1px dashed color-mix(in srgb, var(--muted) 50%, transparent); }

        .sg2-sel i { border-color: var(--text); border-width: 2px; }
        .sg2-count { position: absolute; top: -6px; right: -8px; min-width: 14px; height: 14px;
          padding: 0 3px; border-radius: 7px; background: var(--surface);
          border: 1px solid var(--border-2); color: var(--text);
          font: 600 9px/14px var(--font-mono), monospace; text-align: center; }

        .sg2-resolved:before { content: ""; position: absolute; inset: 0; border-radius: 50%;
          border: 1.5px solid var(--c-high); opacity: .5; animation: sg2pulse 2.6s ease-out infinite; }
        .sg2-still:before { animation: none; }
        @keyframes sg2pulse { 0% { transform: scale(.6); opacity: .7; } 100% { transform: scale(1.8); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .sg2:before { animation: none; } }
      `}</style>
    </div>
  );
}
