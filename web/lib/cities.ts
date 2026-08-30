// Shared geospatial reference — used by the intel generator, the map, analytics
// and the NER analyzer.

export interface City {
  name: string;
  lat: number;
  lng: number;
}

export const JABALPUR = { name: "Jabalpur", lat: 23.1815, lng: 79.9864 };

// Two concentric rings around Jabalpur:
//  - CORE (60km):    solid "JABALPUR JURISDICTION" circle.
//  - NEIGHBOUR (95km): dashed ring covering the neighbour cities (Katni,
//    Narsinghpur), which sit ~83–85km out. A city is IN-ZONE (and breaches)
//    if it falls inside the neighbour ring — driven by real haversine distance,
//    so the in-zone set is exactly Jabalpur, Katni and Narsinghpur.
export const GEOFENCE_CORE_KM = 60;
export const GEOFENCE_ZONE_KM = 95;

export const CITIES: City[] = [
  { name: "Jabalpur", lat: 23.1815, lng: 79.9864 },
  { name: "Katni", lat: 23.8343, lng: 80.3894 },
  { name: "Narsinghpur", lat: 22.9463, lng: 79.1926 },
  { name: "Bhopal", lat: 23.2599, lng: 77.4126 },
  { name: "Indore", lat: 22.7196, lng: 75.8577 },
  { name: "Gwalior", lat: 26.2183, lng: 78.1828 },
  { name: "Ujjain", lat: 23.1765, lng: 75.7885 },
  { name: "Sagar", lat: 23.8388, lng: 78.7378 },
  { name: "Rewa", lat: 24.5362, lng: 81.3037 },
  { name: "Satna", lat: 24.5709, lng: 80.8322 },
];

const CITY_MAP: Record<string, City> = Object.fromEntries(
  CITIES.map((c) => [c.name.toLowerCase(), c])
);

export function getCity(name: string): City | undefined {
  return CITY_MAP[name.toLowerCase()];
}

// Resolve coords for ANY Indian city (MP set first, then the wider gazetteer).
// Used by LIVE OSINT mode to plot real mentions anywhere in India.
import { getIndiaCity } from "./indiaCities";
export function getAnyCity(name: string): City | undefined {
  return getCity(name) ?? getIndiaCity(name);
}

/** Great-circle distance in km between two lat/lng points. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** True if the named city sits inside the Jabalpur geofence (neighbour ring). */
export function isInJabalpurZone(cityName: string): boolean {
  const c = getCity(cityName);
  if (!c) return false;
  return haversineKm(JABALPUR, c) <= GEOFENCE_ZONE_KM;
}

/** True if the city is inside the tighter 60km core jurisdiction. */
export function isInCore(cityName: string): boolean {
  const c = getCity(cityName);
  if (!c) return false;
  return haversineKm(JABALPUR, c) <= GEOFENCE_CORE_KM;
}

export const ZONE_CITIES: string[] = CITIES.filter((c) =>
  isInJabalpurZone(c.name)
).map((c) => c.name);

export const OTHER_CITIES: string[] = CITIES.filter(
  (c) => !isInJabalpurZone(c.name)
).map((c) => c.name);
