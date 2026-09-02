/**
 * SANGAM coordinates (`lib/geoderive.ts`).
 *
 * INV-5, at its sharpest. Where a host does not resolve, this module DERIVES a
 * coordinate from the identifier so the map is deterministic and legible. That
 * is defensible only while two things hold: the derivation is stable, and every
 * derived point is labelled `inferred: true` so it can never be read as a
 * measurement.
 *
 * Phase 5 replaces `inferred: boolean` with a three-class model
 * (RESOLVED / DERIVED / UNAVAILABLE) and its own marker shapes. These tests pin
 * the honesty property that must survive that change, and the determinism
 * property Phase 5's gate re-asserts across processes.
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
   * FINDING-06 (found by this suite, Phase 0b) -- an INV-5 violation, live.
   *
   * `nodesForActor` emits a Binance off-ramp marker for EVERY actor, including
   * one with no infrastructure, no markets and no personas:
   *
   *     offramps.forEach((ex, i) => {
   *       if (i >= Math.max(1, p.infrastructure.length)) return;   // <- max(1, 0) === 1
   *
   * `Math.max(1, ...)` guarantees the first iteration always runs. The marker
   * is then stamped `inferred: false` and captioned "Wallet-cluster cash-out
   * reaches Binance. Known exchange region." -- a positive, unhedged claim
   * about an actor's cash-out route, derived from nothing, rendered on the map
   * with the same styling as a measured fact.
   *
   * The source comment says "(illustrative)". The payload says `inferred:
   * false`. INV-5 is explicit that where a fact is derived or synthetic it is
   * labelled as such in the payload AND on screen.
   *
   * Marked `.fails` rather than asserting the buggy output: pinning the defect
   * would cement it, and skipping it would hide it. As written, the suite stays
   * green today and this test STARTS FAILING the moment someone fixes it --
   * which is the prompt to delete the `.fails` and keep the guarantee.
   *
   * Phase 5 owns the fix: off-ramp geography becomes "always DERIVED, always
   * labelled" under the three-class model. Phase 0b does not touch product code.
   */
  it.fails("FINDING-06: places nothing for an actor with nothing to place", () => {
    expect(
      nodesForActor({ ...profile, markets: [], infrastructure: [], personas: [] })
    ).toEqual([]);
  });

  it.fails("FINDING-06: does not claim a cash-out route as a measured fact", () => {
    const offramps = nodesForActor({
      ...profile,
      markets: [],
      infrastructure: [],
      personas: [],
    }).filter((n) => n.kind === "offramp");
    // Either it should not be there at all, or it must be labelled inferred.
    expect(offramps.every((n) => n.inferred)).toBe(true);
  });

  it("documents the current behaviour so the defect is measurable", () => {
    // What ships today, stated plainly. Not an endorsement -- a measurement.
    const nodes = nodesForActor({
      ...profile,
      markets: [],
      infrastructure: [],
      personas: [],
    });
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("offramp:Binance");
    expect(nodes[0].inferred).toBe(false);
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
