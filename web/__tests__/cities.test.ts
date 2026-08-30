import { describe, it, expect } from "vitest";
import {
  CITIES,
  OTHER_CITIES,
  ZONE_CITIES,
  JABALPUR,
  GEOFENCE_CORE_KM,
  GEOFENCE_ZONE_KM,
  getCity,
  getAnyCity,
  haversineKm,
  isInCore,
  isInJabalpurZone,
} from "@/lib/cities";
import { getIndiaCity } from "@/lib/indiaCities";

// The geofence is the breach predicate — the single most load-bearing thing in
// PRAHARI. These tests exist so a gazetteer edit fails here rather than on stage.

describe("ZONE_CITIES — the in-zone set", () => {
  it("is exactly Jabalpur, Katni and Narsinghpur", () => {
    // Exact set equality, not just membership: an edit that ADDS a zone city
    // is as much a regression as one that drops it.
    expect(ZONE_CITIES).toEqual(["Jabalpur", "Katni", "Narsinghpur"]);
  });

  it("partitions the MP gazetteer with OTHER_CITIES, with no overlap", () => {
    expect(ZONE_CITIES.length + OTHER_CITIES.length).toBe(CITIES.length);
    expect(ZONE_CITIES.filter((c) => OTHER_CITIES.includes(c))).toEqual([]);
  });
});

describe("haversine distances from Jabalpur", () => {
  const km = (name: string) => {
    const c = getCity(name);
    if (!c) throw new Error(`${name} missing from the MP gazetteer`);
    return haversineKm(JABALPUR, c);
  };

  it("puts Katni inside the 95 km zone ring", () => {
    expect(km("Katni")).toBeLessThan(GEOFENCE_ZONE_KM);
    expect(km("Katni")).toBeCloseTo(83.4, 0);
  });

  it("puts Sagar outside the 95 km zone ring", () => {
    expect(km("Sagar")).toBeGreaterThan(GEOFENCE_ZONE_KM);
    expect(km("Sagar")).toBeCloseTo(146.8, 0);
  });

  it("keeps Narsinghpur — the tightest margin — inside the ring", () => {
    // Only ~9.7 km of headroom. If a coordinate is ever "corrected", this is
    // the assertion that catches it.
    const d = km("Narsinghpur");
    expect(d).toBeLessThan(GEOFENCE_ZONE_KM);
    expect(d).toBeCloseTo(85.3, 0);
    expect(GEOFENCE_ZONE_KM - d).toBeGreaterThan(5);
  });

  it("measures Jabalpur against itself as zero", () => {
    expect(km("Jabalpur")).toBeCloseTo(0, 5);
  });

  it("is symmetric", () => {
    const katni = getCity("Katni")!;
    expect(haversineKm(JABALPUR, katni)).toBeCloseTo(haversineKm(katni, JABALPUR), 9);
  });
});

describe("isInJabalpurZone — the breach predicate", () => {
  it("returns true for every zone city and false for every other MP city", () => {
    for (const c of ZONE_CITIES) expect(isInJabalpurZone(c)).toBe(true);
    for (const c of OTHER_CITIES) expect(isInJabalpurZone(c)).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isInJabalpurZone("jabalpur")).toBe(true);
    expect(isInJabalpurZone("KATNI")).toBe(true);
  });

  it("returns false for an unknown city rather than throwing", () => {
    expect(isInJabalpurZone("Atlantis")).toBe(false);
    expect(isInJabalpurZone("")).toBe(false);
  });

  // INV-2. This is the invariant that keeps the national gazetteer from ever
  // being able to trigger a breach.
  it("consults only the MP gazetteer, never the national one", () => {
    const mumbai = "Mumbai";
    expect(getIndiaCity(mumbai)).toBeDefined(); // it IS plottable
    expect(getCity(mumbai)).toBeUndefined(); // but NOT in the MP map
    expect(getAnyCity(mumbai)).toBeDefined();
    expect(isInJabalpurZone(mumbai)).toBe(false); // and so can never breach
  });

  it("cannot be breached by any national-gazetteer city", () => {
    const nationalOnly = ["Mumbai", "Delhi", "Kolkata", "Chennai", "Bengaluru", "Nagpur"];
    for (const c of nationalOnly) {
      expect(getCity(c)).toBeUndefined();
      expect(isInJabalpurZone(c)).toBe(false);
    }
  });
});

describe("isInCore — the 60 km jurisdiction ring", () => {
  it("contains Jabalpur only", () => {
    expect(isInCore("Jabalpur")).toBe(true);
    expect(isInCore("Katni")).toBe(false);
    expect(isInCore("Narsinghpur")).toBe(false);
  });

  it("is strictly tighter than the zone ring", () => {
    expect(GEOFENCE_CORE_KM).toBeLessThan(GEOFENCE_ZONE_KM);
    for (const c of CITIES) {
      if (isInCore(c.name)) expect(isInJabalpurZone(c.name)).toBe(true);
    }
  });
});

describe("gazetteer integrity", () => {
  it("has unique city names", () => {
    const names = CITIES.map((c) => c.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it("has plausible coordinates for Madhya Pradesh", () => {
    for (const c of CITIES) {
      expect(c.lat).toBeGreaterThan(21);
      expect(c.lat).toBeLessThan(27);
      expect(c.lng).toBeGreaterThan(74);
      expect(c.lng).toBeLessThan(83);
    }
  });

  it("pins Jabalpur at the documented centre", () => {
    expect(JABALPUR.lat).toBe(23.1815);
    expect(JABALPUR.lng).toBe(79.9864);
  });
});
