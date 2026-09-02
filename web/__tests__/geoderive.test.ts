/**
 * SANGAM coordinates (`lib/geoderive.ts`).
 *
 * INV-5, at its sharpest. Where a host does not resolve, this module DERIVES a
 * coordinate from the identifier so the map is deterministic and legible. That
 * is defensible only while two things hold: the derivation is stable, and every
 * derived point is labelled `inferred: true` so it can never be read as a
 * measurement.
 *
 * Phase 5 added the engine-side three-class model (RESOLVED / DERIVED /
 * UNAVAILABLE) in `engine/geo/classify.py`, with its own marker shapes and its
 * own tests. This module keeps its `inferred` flag because the map still reads
 * it and the prime directive says not to break a working caller -- so these
 * tests pin the honesty and determinism properties on THIS side of the line.
 *
 * FINDING-06 was found here in Phase 0b and fixed here in DEC-061.
 */
import { describe, it, expect } from "vitest";
import { nodesForActor, centroid, haversineKm, type GeoNode } from "@/lib/geoderive";

const profile = {
  actor_id: "actor-088",
  label: "nightowl1",
  personas: [{ handle: "nightowl1", market: "AlphaBay" }],
  infrastructure: [
    { clearnet_host: "cdn.example.test", strength: 0.83 },
    { clearnet_host: "mail.example.test", strength: 0.61 },
  ],
  markets: ["AlphaBay", "Evolution"],
};

describe("nodesForActor - honesty", () => {
  it("labels every unresolved infrastructure host as inferred", () => {
    const infra = nodesForActor(profile).filter((n) => n.kind === "infra");
    expect(infra.length).toBe(2);
    expect(infra.every((n) => n.inferred)).toBe(true);
  });

  it("says so in the detail text, not only in a flag", () => {
    // A boolean nobody renders is not honesty. The sentence is what the
    // analyst actually reads.
    const infra = nodesForActor(profile).filter((n) => n.kind === "infra");
    expect(infra.every((n) => /Inferred hosting region/i.test(n.detail))).toBe(true);
  });

  it("marks a known market region as not inferred, and an unknown one as inferred", () => {
    const nodes = nodesForActor({ ...profile, markets: ["AlphaBay", "Nowhereia"] });
    const known = nodes.find((n) => n.id === "market:AlphaBay");
    const unknown = nodes.find((n) => n.id === "market:Nowhereia");
    expect(known?.inferred).toBe(false);
    expect(known?.detail).toMatch(/Known hosting region/i);
    expect(unknown?.inferred).toBe(true);
    expect(unknown?.detail).toMatch(/Inferred region/i);
  });

  it("never invents a resolution field for a derived point", () => {
    // INV-5: an unpopulated field must stay unpopulated rather than get a
    // plausible-looking placeholder.
    for (const n of nodesForActor(profile).filter((x) => x.inferred)) {
      expect(n.ip).toBeUndefined();
      expect(n.asn ?? null).toBeNull();
      expect(n.org ?? null).toBeNull();
      expect(n.city ?? null).toBeNull();
    }
  });
});

describe("nodesForActor - determinism", () => {
  it("produces identical coordinates across repeated calls", () => {
    const a = nodesForActor(profile);
    const b = nodesForActor(profile);
    expect(a).toEqual(b);
  });

  it("derives the same coordinate for the same host regardless of the actor", () => {
    const other = nodesForActor({ ...profile, actor_id: "actor-999", label: "other" });
    const findHost = (ns: GeoNode[]) => ns.find((n) => n.id === "infra:cdn.example.test");
    expect(findHost(other)).toMatchObject({
      lat: findHost(nodesForActor(profile))!.lat,
      lng: findHost(nodesForActor(profile))!.lng,
    });
  });

  it("keeps derived coordinates inside valid, populated latitudes", () => {
    for (const n of nodesForActor(profile)) {
      expect(n.lat).toBeGreaterThanOrEqual(-90);
      expect(n.lat).toBeLessThanOrEqual(90);
      expect(n.lng).toBeGreaterThanOrEqual(-180);
      expect(n.lng).toBeLessThanOrEqual(180);
    }
  });

  it("does not jitter: two calls give byte-identical coordinates", () => {
    // Phase 5 makes this a hard rule -- scattering co-located points to look
    // prettier is fabrication. Asserted now so the property is already held.
    const runs = [1, 2, 3].map(() => nodesForActor(profile).map((n) => [n.lat, n.lng]));
    expect(runs[0]).toEqual(runs[1]);
    expect(runs[1]).toEqual(runs[2]);
  });

  it("deduplicates repeated markets rather than stacking markers", () => {
    const nodes = nodesForActor({ ...profile, markets: ["AlphaBay", "AlphaBay"] });
    expect(nodes.filter((n) => n.id === "market:AlphaBay")).toHaveLength(1);
  });

  /**
   * FINDING-06, FIXED in DEC-061.
   *
   * `nodesForActor` used to emit a Binance off-ramp for EVERY actor, including
   * one with no infrastructure, markets or personas -- `Math.max(1, length)`
   * guaranteed the first iteration always ran. It was stamped
   * `inferred: false` and captioned "Wallet-cluster cash-out reaches Binance.
   * Known exchange region.": a positive claim about an actor's cash-out route,
   * derived from nothing, drawn with the styling of a measurement.
   *
   * These were `it.fails` from Phase 0b through Phase 4, so the suite stayed
   * green while the defect stayed visible. They are now ordinary assertions --
   * which is what "the tests flip the moment someone fixes it" was for.
   */
  it("FINDING-06: places nothing for an actor with nothing to place", () => {
    expect(
      nodesForActor({ ...profile, markets: [], infrastructure: [], personas: [] })
    ).toEqual([]);
  });

  it("FINDING-06: emits no off-ramp without evidence naming one", () => {
    const offramps = nodesForActor({
      ...profile,
      markets: [],
      infrastructure: [],
      personas: [],
    }).filter((n) => n.kind === "offramp");
    expect(offramps).toEqual([]);
  });

  it("FINDING-06: an off-ramp that IS emitted is labelled inferred", () => {
    // Evidence naming an exchange is what earns a marker...
    const nodes = nodesForActor({
      ...profile,
      markets: ["Binance"],
      infrastructure: [],
      personas: [{ handle: "x", market: "Binance" }],
    });
    const offramps = nodes.filter((n) => n.kind === "offramp");
    expect(offramps).toHaveLength(1);
    // ...and even then it is derived, not measured.
    expect(offramps[0].inferred).toBe(true);
    expect(offramps[0].detail).toContain("not a measured location");
    expect(offramps[0].detail).toContain("not where any transaction occurred");
  });

  it("FINDING-06: no longer claims a cash-out route as a measured fact", () => {
    const measured = nodesForActor(profile).filter((n) => !n.inferred && n.kind === "offramp");
    expect(measured).toEqual([]);
  });
});

describe("centroid", () => {
  it("averages the points", () => {
    const nodes = [
      { lat: 10, lng: 20 },
      { lat: 30, lng: 40 },
    ] as GeoNode[];
    expect(centroid(nodes)).toEqual([20, 30]);
  });

  it("returns a neutral default for an empty set rather than NaN", () => {
    // NaN would render as a blank map with no explanation.
    expect(centroid([])).toEqual([20, 0]);
  });
});

describe("haversineKm", () => {
  it("is zero for a point against itself", () => {
    expect(haversineKm([21.15, 79.09], [21.15, 79.09])).toBe(0);
  });

  it("is symmetric", () => {
    const a: [number, number] = [52.37, 4.9];
    const b: [number, number] = [50.11, 8.68];
    expect(haversineKm(a, b)).toBe(haversineKm(b, a));
  });

  it("matches a known distance: Amsterdam to Frankfurt is about 365 km", () => {
    expect(haversineKm([52.37, 4.9], [50.11, 8.68])).toBeGreaterThan(350);
    expect(haversineKm([52.37, 4.9], [50.11, 8.68])).toBeLessThan(380);
  });

  it("handles an antimeridian pair without returning a negative distance", () => {
    expect(haversineKm([0, 179], [0, -179])).toBeGreaterThan(0);
  });
});
