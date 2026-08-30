"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Circle,
  Marker,
  Tooltip,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  CITIES,
  JABALPUR,
  GEOFENCE_CORE_KM,
  GEOFENCE_ZONE_KM,
  isInJabalpurZone,
  haversineKm,
  getAnyCity,
} from "@/lib/cities";
import { useIntel } from "@/store/intel";

interface Siren {
  id: number;
  lat: number;
  lng: number;
  breach: boolean;
}

// ---- Basemap options (all free, no API key) ---------------------------------
interface Layer {
  id: string;
  name: string;
  url: string;
  grade: "dark" | "satellite" | "none";
  attribution?: string;
}
const LAYERS: Layer[] = [
  { id: "dark", name: "Dark", url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", grade: "dark" },
  { id: "light", name: "Light", url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", grade: "none" },
  { id: "streets", name: "Streets", url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", grade: "none" },
  { id: "satellite", name: "Satellite", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", grade: "satellite" },
];

function cityIcon(heat: number, isZone: boolean, name: string) {
  const size = Math.round(9 + Math.min(heat, 10) * 1.8);
  const color = heat === 0 ? "#71717A" : isZone ? "#FF3B30" : "#C11030";
  const glow = heat > 0 ? `box-shadow:0 0 ${6 + heat * 2}px ${color};` : "";
  const alpha = heat > 0 ? 1 : 0.55;
  const dot = `<div class="map-marker-dot" style="width:${size}px;height:${size}px;border-radius:50%;background:${color};opacity:${alpha};${glow}border:1px solid rgba(255,255,255,0.85)"></div>`;
  // Bake a readable label into the icon once a city is active (reliable, unlike
  // react-leaflet's dynamic `permanent` tooltip).
  const label =
    heat > 0
      ? `<div style="position:absolute;left:50%;top:${size + 3}px;transform:translateX(-50%);font-family:var(--font-mono);font-size:9px;font-weight:600;letter-spacing:0.06em;color:${color};white-space:nowrap;text-shadow:0 0 6px #000,0 0 6px #000">${name.toUpperCase()}${isZone ? " ◆" : ""}</div>`
      : "";
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center">${dot}${label}</div>`,
  });
}

function sirenIcon(breach: boolean) {
  const color = breach ? "#FF3B30" : "#C11030";
  const s = breach ? 160 : 110;
  return L.divIcon({
    className: "",
    iconSize: [s, s],
    iconAnchor: [s / 2, s / 2],
    html: `<div class="siren" style="--c:${color}"></div>`,
  });
}

function labelIcon(text: string, color: string) {
  return L.divIcon({
    className: "",
    iconSize: [200, 16],
    iconAnchor: [100, 8],
    html: `<div style="font-family:var(--font-mono);font-size:9px;letter-spacing:0.18em;color:${color};text-align:center;white-space:nowrap;text-shadow:0 0 8px rgba(0,0,0,0.9)">${text}</div>`,
  });
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    map.invalidateSize();
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/** Flies the map to a focus target (set when the user clicks an alert/city). */
function MapFocuser() {
  const map = useMap();
  const focus = useIntel((s) => s.focusTarget);
  useEffect(() => {
    if (!focus) return;
    map.flyTo([focus.lat, focus.lng], 8.5, { duration: 1.1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.seq]);
  return null;
}

export default function MapView() {
  const cityHeat = useIntel((s) => s.cityHeat);
  const lastPulse = useIntel((s) => s.lastPulse);
  const registerCities = useIntel((s) => s.registerCities);
  const [sirens, setSirens] = useState<Siren[]>([]);
  const [layerId, setLayerId] = useState("dark");
  const layer = LAYERS.find((l) => l.id === layerId) ?? LAYERS[0];

  useEffect(() => {
    if (!lastPulse) return;
    const id = lastPulse.seq;
    setSirens((prev) => [...prev, { id, lat: lastPulse.lat, lng: lastPulse.lng, breach: lastPulse.breach }]);
    const t = setTimeout(() => setSirens((prev) => prev.filter((s) => s.id !== id)), 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPulse?.seq]);

  const coreLat = JABALPUR.lat + GEOFENCE_CORE_KM / 111 + 0.08;
  const zoneLat = JABALPUR.lat + GEOFENCE_ZONE_KM / 111 + 0.1;
  const gradeClass = layer.grade === "dark" ? "grade-dark" : layer.grade === "satellite" ? "grade-satellite" : "";

  // fixed MP cities + any extra city that became active via LIVE OSINT
  const extra = Object.keys(cityHeat)
    .filter((n) => !CITIES.some((c) => c.name.toLowerCase() === n.toLowerCase()))
    .map((n) => getAnyCity(n))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const renderCities = [...CITIES, ...extra];

  return (
    <div className="relative h-full w-full">
      {/* Layer switcher */}
      <div className="absolute right-2 top-2 z-[600] flex overflow-hidden border border-border bg-black/80 backdrop-blur-sm">
        {LAYERS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLayerId(l.id)}
            className={`mono px-2 py-1 text-[9px] uppercase tracking-wider transition ${
              l.id === layerId ? "bg-red text-white" : "text-muted hover:text-text"
            }`}
          >
            {l.name}
          </button>
        ))}
      </div>

      <MapContainer
        center={[23.5, 78.5]}
        zoom={6.5}
        zoomControl
        attributionControl={false}
        scrollWheelZoom
        className={gradeClass}
        style={{ height: "100%", width: "100%", background: "#131318" }}
      >
        <MapResizer />
        <MapFocuser />
        <TileLayer key={layer.id} url={layer.url} crossOrigin />

        {/* Neighbour ring (95km, dashed) */}
        <Circle
          center={[JABALPUR.lat, JABALPUR.lng]}
          radius={GEOFENCE_ZONE_KM * 1000}
          pathOptions={{ color: "#C11030", weight: 1.5, dashArray: "6 8", fillColor: "#E10600", fillOpacity: 0.03 }}
        />
        {/* Core jurisdiction (60km, solid pulsing) */}
        <Circle
          center={[JABALPUR.lat, JABALPUR.lng]}
          radius={GEOFENCE_CORE_KM * 1000}
          pathOptions={{ color: "#FF3B30", weight: 2, fillColor: "#E10600", fillOpacity: 0.07 }}
          eventHandlers={{
            add: (e) => {
              const el = (e.target as L.Path).getElement();
              if (el) (el as SVGElement).classList.add("geofence-ring");
            },
          }}
        />

        <Marker position={[coreLat, JABALPUR.lng]} icon={labelIcon("◎ JABALPUR JURISDICTION", "#FF3B30")} interactive={false} />
        <Marker position={[zoneLat, JABALPUR.lng]} icon={labelIcon("NEIGHBOUR RING · KATNI · NARSINGHPUR", "#C11030")} interactive={false} />

        {sirens.map((s) => (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={sirenIcon(s.breach)} interactive={false} />
        ))}

        {renderCities.map((c) => {
          const heat = cityHeat[c.name] ?? 0;
          const zone = isInJabalpurZone(c.name);
          const dist = Math.round(haversineKm(JABALPUR, c));
          return (
            <Marker key={c.name} position={[c.lat, c.lng]} icon={cityIcon(heat, zone, c.name)}>
              <Tooltip direction="top" offset={[0, -8]} className="prahari-tip" opacity={1}>
                {c.name.toUpperCase()}
                {zone ? " · IN-ZONE" : ""}
                {heat > 0 ? ` · ×${heat}` : ""}
              </Tooltip>
              <Popup>
                <div style={{ fontFamily: "var(--font-mono)", minWidth: 150 }}>
                  <div style={{ fontWeight: 700, color: "#F4F4F5", fontSize: 13 }}>{c.name}</div>
                  <div style={{ fontSize: 10, color: zone ? "#FF3B30" : "#B4B4BE", marginTop: 2 }}>
                    {zone ? "INSIDE JABALPUR GEOFENCE" : "OUTSIDE GEOFENCE"}
                  </div>
                  <div style={{ fontSize: 11, color: "#B4B4BE", marginTop: 6 }}>
                    {dist} km from Jabalpur<br />
                    Threat-heat: {heat}<br />
                    {c.lat.toFixed(3)}, {c.lng.toFixed(3)}
                  </div>
                  <button
                    onClick={() => registerCities([c.name], "analysis")}
                    style={{
                      marginTop: 8, width: "100%", padding: "5px", cursor: "pointer",
                      background: "#E10600", color: "#fff", border: "none", borderRadius: 3,
                      fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                    }}
                  >
                    Ping this city
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
