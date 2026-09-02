/**
 * SANGAM Pro, client side (DEC-061, DEC-062).
 *
 * The gate items here: the class survives a GeoJSON and CSV round-trip, a
 * derived point is never compared without a warning, and nothing is silently
 * dropped from an export.
 */
import { describe, it, expect } from "vitest";
import {
  CLASS_MEANING, CLASS_SHAPE, DERIVED, FRESHNESS_WINDOW_S, RESOLVED, UNAVAILABLE,
  ageSeconds, classesFromCSV, comparable, distanceKm, isPlotted, isStale, plottable,
  sharedFacts, toCSV, toGeoJSON, unplaced, type ClassifiedPoint,
} from "@/lib/sangamClass";

const base: ClassifiedPoint = {
  host: "cdn.example.test",
  class: RESOLVED,
  lat: 52.3702,
  lng: 4.8952,
  ip: "1.2.3.4",
  reverse_dns: "edge.example.test",
  asn: 13335,
  asn_org: "Cloudflare",
  city: "Amsterdam",
  region: "North Holland",
  country: "Netherlands",
  country_code: "NL",
  provider: "ipwho.is",
  resolver_used: "system resolver (getaddrinfo)",
  ttl: null,
  resolved_at: new Date().toISOString(),
  reason: null,
  derivation_rule: null,
  resolution_chain: [],
  cache_age_s: 0,
};

const derived: ClassifiedPoint = {
  ...base,
  host: "alphabay-mirror.invalid",
  class: DERIVED,
  lat: 52.4,
  lng: 4.9,
  ip: null,
  asn: null,
  asn_org: null,
  city: null,
  provider: null,
  derivation_rule: "host contains 'alphabay' -> Amsterdam hosting region",
  reason: "This is not a measured location. It represents a known hosting region for this host class.",
};

const onion: ClassifiedPoint = {
  ...base,
  host: "secret.onion",
  class: UNAVAILABLE,
  lat: null,
  lng: null,
  ip: null,
  asn: null,
  asn_org: null,
  city: null,
  country: null,
  country_code: null,
  provider: null,
  reason: "onion — resolution refused by design",
};

describe("the three classes", () => {
  it("distinguishes them by SHAPE, not by colour alone", () => {
    // Colour is skin-dependent and fails for colour-blind readers.
    expect(CLASS_SHAPE.resolved).toBe("solid-pin");
    expect(CLASS_SHAPE.derived).toBe("hollow-dashed-pin");
    expect(CLASS_SHAPE.unavailable).toBe("not-plotted");
    expect(new Set(Object.values(CLASS_SHAPE)).size).toBe(3);
  });

  it("carries the exact 'not a measured location' sentence for derived", () => {
    expect(CLASS_MEANING.derived).toContain("This is not a measured location");
    expect(CLASS_MEANING.derived).toContain("known hosting region for this host class");
  });

  it("says a resolved point is measured", () => {
    expect(CLASS_MEANING.resolved).toContain("Measured");
  });

  it("plots resolved and derived, and never unavailable", () => {
    expect(isPlotted(base)).toBe(true);
    expect(isPlotted(derived)).toBe(true);
    expect(isPlotted(onion)).toBe(false);
  });

  it("treats a point with a class but no coordinate as unplottable", () => {
    // Belt and braces: a payload claiming `resolved` with null lat is a bug
    // somewhere, and the map must not try to draw it at 0,0.
    expect(isPlotted({ ...base, lat: null })).toBe(false);
  });

  it("splits a set into plotted and unplaced", () => {
    const all = [base, derived, onion];
    expect(plottable(all).map((p) => p.host)).toEqual([base.host, derived.host]);
    expect(unplaced(all).map((p) => p.host)).toEqual([onion.host]);
  });
});

describe("derived points carry no precision they do not have", () => {
  it("is rounded to one decimal place", () => {
    expect(Math.round(derived.lat! * 10) / 10).toBe(derived.lat);
    expect(Math.round(derived.lng! * 10) / 10).toBe(derived.lng);
  });

  it("has no city, ASN, IP or provider", () => {
    // A region is not a city and has no ASN. Populating either would be a
    // placeholder dressed as a measurement (INV-5).
    for (const field of ["ip", "asn", "asn_org", "city", "provider"] as const) {
      expect(derived[field], field).toBeNull();
    }
  });

  it("names the rule that produced it", () => {
    expect(derived.derivation_rule).toContain("alphabay");
  });
});

describe("comparison refuses to read precision that is not there", () => {
  it("compares two resolved points", () => {
    const other = { ...base, host: "b.test", lat: 50.11, lng: 8.68 };
    expect(comparable(base, other).ok).toBe(true);
    expect(distanceKm(base, other)).toBeGreaterThan(350);
  });

  it("refuses when either point is derived, and says why", () => {
    const c = comparable(base, derived);
    expect(c.ok).toBe(false);
    expect(c.warning).toContain("derived region");
    expect(c.warning).toContain("not a measured location");
  });

  it("names BOTH points when both are derived", () => {
    const c = comparable(derived, { ...derived, host: "dream.invalid" });
    expect(c.warning).toContain("alphabay-mirror.invalid");
    expect(c.warning).toContain("dream.invalid");
    expect(c.warning).toContain("are a derived");
  });

  it("refuses when a point has no coordinate", () => {
    expect(comparable(base, onion).ok).toBe(false);
  });

  it("reports only facts the two genuinely share", () => {
    const twin = { ...base, host: "b.test" };
    const facts = sharedFacts(base, twin);
    expect(facts.join(" ")).toContain("AS13335");
    expect(facts.join(" ")).toContain("co-located");
  });

  it("shares nothing when nothing is shared", () => {
    const other = { ...base, host: "b.test", asn: 99, asn_org: "Other", country_code: "DE", country: "Germany", lat: 1, lng: 2 };
    expect(sharedFacts(base, other)).toEqual([]);
  });
});

describe("freshness", () => {
  it("a point resolved now is fresh", () => {
    expect(isStale(base)).toBe(false);
    expect(ageSeconds(base)).toBeLessThan(5);
  });

  it("a point older than the window is stale", () => {
    const old = { ...base, resolved_at: new Date(Date.now() - 2 * FRESHNESS_WINDOW_S * 1000).toISOString() };
    // A stale location presented as current is a false statement.
    expect(isStale(old)).toBe(true);
  });

  it("an unparseable timestamp gives an unknown age, not zero", () => {
    expect(ageSeconds({ ...base, resolved_at: "nonsense" })).toBeNull();
    expect(ageSeconds({ ...base, resolved_at: null })).toBeNull();
  });
});

describe("GeoJSON export", () => {
  const parsed = JSON.parse(toGeoJSON([base, derived, onion], { actor: "actor-088" }));

  it("is a FeatureCollection carrying the class meanings", () => {
    expect(parsed.type).toBe("FeatureCollection");
    expect(parsed.properties.classes.derived).toContain("not a measured location");
  });

  it("preserves the class on every feature", () => {
    expect(parsed.features.map((f: { properties: { class: string } }) => f.properties.class)).toEqual([
      "resolved", "derived", "unavailable",
    ]);
  });

  /**
   * The class must survive leaving the tool, and so must the absences. A file
   * that silently omits unavailable points tells the recipient there were two
   * hosts when there were three — and the one it dropped is the `.onion`
   * refusal, which is the most interesting row in the file.
   */
  it("includes unavailable points with NULL geometry rather than dropping them", () => {
    expect(parsed.features).toHaveLength(3);
    const un = parsed.features[2];
    expect(un.geometry).toBeNull();
    expect(un.properties.reason).toBe("onion — resolution refused by design");
  });

  it("puts real coordinates in lng,lat order", () => {
    expect(parsed.features[0].geometry.coordinates).toEqual([base.lng, base.lat]);
  });

  it("carries the derivation rule on a derived feature", () => {
    expect(parsed.features[1].properties.derivation_rule).toContain("alphabay");
  });

  it("states the honesty rule in the file itself", () => {
    expect(parsed.properties.honesty).toContain("is a region, not a");
    expect(parsed.properties.honesty).toContain("nothing is silently missing");
  });
});

describe("CSV export", () => {
  const csv = toCSV([base, derived, onion]);

  it("has class as a first-class column", () => {
    expect(csv.split("\n")[0].split(",")).toContain("class");
  });

  it("round-trips the class for every row", () => {
    expect(classesFromCSV(csv)).toEqual([
      { host: "cdn.example.test", cls: "resolved" },
      { host: "alphabay-mirror.invalid", cls: "derived" },
      { host: "secret.onion", cls: "unavailable" },
    ]);
  });

  it("includes unavailable rows with empty coordinates", () => {
    expect(csv.split("\n")).toHaveLength(4);
    expect(csv).toContain("refused by design");
  });

  it("quotes a value containing a comma without corrupting the row", () => {
    const tricky = { ...base, host: "a.test", asn_org: "Big, Corp" };
    const round = classesFromCSV(toCSV([tricky]));
    expect(round).toEqual([{ host: "a.test", cls: "resolved" }]);
    expect(toCSV([tricky])).toContain('"Big, Corp"');
  });

  it("escapes an embedded quote", () => {
    const tricky = { ...base, host: 'a".test' };
    expect(classesFromCSV(toCSV([tricky]))[0].host).toBe('a".test');
  });

  it("renders a null as empty, never as the string null", () => {
    const row = toCSV([onion]).split("\n")[1];
    expect(row).not.toContain("null");
    expect(row).not.toContain("undefined");
  });
});
