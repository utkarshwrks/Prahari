import * as THREE from "three";

/** Lat/lng (degrees) to a point on a sphere of radius r. */
export function latLngToVec3(lat: number, lng: number, r: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

/** A great-circle-ish arc between two surface points, bowed out into space. */
export function arcCurve(a: THREE.Vector3, b: THREE.Vector3, lift = 0.5): THREE.CubicBezierCurve3 {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const dist = a.distanceTo(b);
  const up = mid.clone().normalize().multiplyScalar(mid.length() + dist * lift);
  const c1 = a.clone().lerp(up, 0.5);
  const c2 = b.clone().lerp(up, 0.5);
  return new THREE.CubicBezierCurve3(a, c1, c2, b);
}

// A spread of real-world points the threat arcs hop between. Not tied to any
// one jurisdiction — this is the global picture the PS is about.
export const NODES: { lat: number; lng: number; kind: "market" | "clearnet" | "mixer" }[] = [
  { lat: 52.37, lng: 4.90, kind: "market" },    // Amsterdam
  { lat: 40.71, lng: -74.0, kind: "clearnet" }, // New York
  { lat: 51.51, lng: -0.13, kind: "clearnet" }, // London
  { lat: 55.75, lng: 37.62, kind: "mixer" },    // Moscow
  { lat: 1.35, lng: 103.82, kind: "clearnet" }, // Singapore
  { lat: -33.87, lng: 151.21, kind: "market" }, // Sydney
  { lat: 50.11, lng: 8.68, kind: "clearnet" },  // Frankfurt
  { lat: 35.68, lng: 139.69, kind: "market" },  // Tokyo
  { lat: 19.08, lng: 72.88, kind: "market" },   // Mumbai
  { lat: 28.61, lng: 77.21, kind: "clearnet" }, // Delhi
  { lat: 37.77, lng: -122.42, kind: "mixer" },  // SF
  { lat: -23.55, lng: -46.63, kind: "market" }, // São Paulo
  { lat: 25.20, lng: 55.27, kind: "clearnet" }, // Dubai
  { lat: 48.85, lng: 2.35, kind: "market" },    // Paris
];
