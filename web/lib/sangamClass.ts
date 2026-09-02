/**
 * THE THREE COORDINATE CLASSES, CLIENT SIDE (DEC-061, DEC-062).
 *
 * Mirrors `engine/geo/classify.py`. The engine decides the class; this decides
 * how it is drawn and exported, and it never re-derives a class of its own —
 * a UI that classified independently could disagree with the payload, and then
 * the map and the API would be telling an analyst different things.
 *
 * MARKER SHAPE, NOT COLOUR ALONE. Colour is skin-dependent and fails for
 * colour-blind readers, so the distinction is carried by shape first:
 *
 *   RESOLVED     solid pin
 *   DERIVED      hollow pin with a dashed ring
 *   UNAVAILABLE  not plotted at all; listed with its reason
 */

export const RESOLVED = "resolved";
export const DERIVED = "derived";
export const UNAVAILABLE = "unavailable";

export type GeoClass = typeof RESOLVED | typeof DERIVED | typeof UNAVAILABLE;

export interface ChainStep {
  step: string;
  detail: string;
  at: string;
  ok: boolean;
}

/** One point, exactly as the engine reports it. */
export interface ClassifiedPoint {
  host: string;
  class: GeoClass;
  lat: number | null;
  lng: number | null;
  ip: string | null;
  reverse_dns: string | null;
  asn: number | null;
  asn_org: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
  provider: string | null;
  resolver_used: string | null;
  ttl: number | null;
  resolved_at: string | null;
  reason: string | null;
  derivation_rule: string | null;
  resolution_chain: ChainStep[];
  cache_age_s: number | null;
}

export const CLASS_LABEL: Record<GeoClass, string> = {
  resolved: "Resolved",
  derived: "Derived",
  unavailable: "Unavailable",
};

/**
 * What each class means, in the words that go on screen.
 *
 * The DERIVED sentence is verbatim from the playbook, and it is the single most
 * important string in this file: it is what stops a reader treating a region as
 * an address.
 */
export const CLASS_MEANING: Record<GeoClass, string> = {
  resolved:
    "The host resolved in DNS and a geo-IP provider returned a location for the address. Measured.",
  derived:
    "This is not a measured location. It represents a known hosting region for this host class.",
  unavailable:
    "There is nothing to place. The point is not plotted; the reason is listed instead.",
};

/** Marker shape per class. Shape carries the distinction; colour only supports it. */
export const CLASS_SHAPE: Record<GeoClass, "solid-pin" | "hollow-dashed-pin" | "not-plotted"> = {
  resolved: "solid-pin",
  derived: "hollow-dashed-pin",
  unavailable: "not-plotted",
};

export const isPlotted = (p: ClassifiedPoint): boolean =>
  p.class !== UNAVAILABLE && p.lat !== null && p.lng !== null;

/** Points that go on the map. */
export const plottable = (points: ClassifiedPoint[]): ClassifiedPoint[] => points.filter(isPlotted);

/** Points that do not, with their reasons. The "unplaced" panel. */
export const unplaced = (points: ClassifiedPoint[]): ClassifiedPoint[] =>
  points.filter((p) => !isPlotted(p));

/**
 * Freshness. A stale location presented as current is a false statement.
 *
 * 24 hours, matching `FRESHNESS_WINDOW_S` on the engine.
 */
export const FRESHNESS_WINDOW_S = 24 * 60 * 60;

export function ageSeconds(p: ClassifiedPoint, now: number = Date.now()): number | null {
  if (!p.resolved_at) return null;
  const t = Date.parse(p.resolved_at);
  return Number.isNaN(t) ? null : Math.floor((now - t) / 1000);
}

export function isStale(p: ClassifiedPoint, now: number = Date.now()): boolean {
  const age = ageSeconds(p, now);
  return age !== null && age > FRESHNESS_WINDOW_S;
}

/**
 * May these two points be compared?
 *
 * A DERIVED point is a region, so a distance to or from one is a distance
 * between a place and an approximation of a place. The comparison is not
 * refused outright — an analyst may still want it — but it is refused SILENTLY
 * nowhere: the caller gets a reason it must display.
 */
export function comparable(
  a: ClassifiedPoint,
  b: ClassifiedPoint
): { ok: boolean; warning: string | null } {
  if (!isPlotted(a) || !isPlotted(b)) {
    return { ok: false, warning: "One of these points has no coordinate to compare." };
  }
  const derivedOnes = [a, b].filter((p) => p.class === DERIVED).map((p) => p.host);
  if (derivedOnes.length) {
    return {
      ok: false,
      warning:
        `${derivedOnes.join(" and ")} ${derivedOnes.length > 1 ? "are" : "is"} a derived ` +
        "region, not a measured location. A distance to it is a distance to an " +
        "approximation, and co-location analysis across it would be reading precision " +
        "the data does not have.",
    };
  }
  return { ok: true, warning: null };
}

/** Haversine, in km. */
export function distanceKm(a: ClassifiedPoint, b: ClassifiedPoint): number | null {
  if (a.lat === null || a.lng === null || b.lat === null || b.lng === null) return null;
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

/** What two points genuinely share. Facts only. */
export function sharedFacts(a: ClassifiedPoint, b: ClassifiedPoint): string[] {
  const out: string[] = [];
  if (a.asn !== null && a.asn === b.asn) out.push(`Same ASN: AS${a.asn}`);
  if (a.asn_org && a.asn_org === b.asn_org) out.push(`Same network operator: ${a.asn_org}`);
  if (a.country_code && a.country_code === b.country_code) out.push(`Same country: ${a.country}`);
  if (a.lat === b.lat && a.lng === b.lng) out.push("Identical coordinate — these are co-located");
  return out;
}

// ---------------------------------------------------------------------------
// Exports. The class must survive leaving the tool.
// ---------------------------------------------------------------------------

/**
 * GeoJSON, with `class` on every feature.
 *
 * UNAVAILABLE points are included as features with a NULL geometry rather than
 * dropped. A file that silently omits them tells the recipient there were four
 * hosts when there were seven, and the three it lost are exactly the
 * interesting ones — the `.onion` refusals.
 */
export function toGeoJSON(points: ClassifiedPoint[], meta: Record<string, unknown> = {}): string {
  return JSON.stringify(
    {
      type: "FeatureCollection",
      properties: {
        ...meta,
        generated_at: new Date().toISOString(),
        classes: CLASS_MEANING,
        honesty:
          "Every feature carries its class. A 'derived' feature is a region, not a " +
          "measured location. An 'unavailable' feature has null geometry and a reason; " +
          "it is included so nothing is silently missing.",
      },
      features: points.map((p) => ({
        type: "Feature",
        geometry: isPlotted(p) ? { type: "Point", coordinates: [p.lng, p.lat] } : null,
        properties: {
          host: p.host,
          class: p.class,
          reason: p.reason,
          derivation_rule: p.derivation_rule,
          ip: p.ip,
          asn: p.asn,
          asn_org: p.asn_org,
          city: p.city,
          country: p.country,
          resolved_at: p.resolved_at,
          provider: p.provider,
        },
      })),
    },
    null,
    2
  );
}

const csvCell = (v: unknown): string => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV, with `class` as a first-class column. */
export function toCSV(points: ClassifiedPoint[]): string {
  const cols = [
    "host", "class", "lat", "lng", "ip", "asn", "asn_org", "city", "country",
    "provider", "resolved_at", "derivation_rule", "reason",
  ] as const;
  const rows = points.map((p) => cols.map((c) => csvCell(p[c as keyof ClassifiedPoint])).join(","));
  return [cols.join(","), ...rows].join("\n");
}

/** Parse a CSV back, so the round-trip test can prove the class survived. */
export function classesFromCSV(csv: string): { host: string; cls: string }[] {
  const [header, ...lines] = csv.split("\n").filter(Boolean);
  const cols = header.split(",");
  const hostAt = cols.indexOf("host");
  const classAt = cols.indexOf("class");
  return lines.map((l) => {
    // Small parser: the writer quotes only when needed and never emits newlines
    // inside a cell, so a full CSV dialect is not required here.
    const cells: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (quoted) {
        if (ch === '"' && l[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    return { host: cells[hostAt], cls: cells[classAt] };
  });
}
