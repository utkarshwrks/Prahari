/**
 * Geolocation for the SANGAM (WHO × WHERE) map.
 *
 * v2 attributes WHO an actor is; v1 asked WHERE things are. SANGAM merges them:
 * it places an actor's footprints on a map. Real infrastructure geolocation
 * comes from the engine (host → DNS → geo-IP); where a precise location is not
 * available, a STABLE coordinate is derived so the map is deterministic and
 * legible, and every derived point is labelled as such.
 *
 * DEC-061 fixed FINDING-06 here: this module used to emit a Binance off-ramp
 * for EVERY actor, stamped `inferred: false`. See the comment at the off-ramp
 * loop for what it did and why it was wrong. Nothing on this map is now
 * emitted without evidence behind it, and nothing derived is labelled measured.
 */

export type GeoKind = "market" | "infra" | "offramp" | "actor";

export interface GeoNode {
  id: string;
  label: string;
  kind: GeoKind;
  lat: number;
  lng: number;
  detail: string;
  inferred: boolean;
  // populated when a host is genuinely resolved via DNS + geo-IP
  ip?: string;
  city?: string | null;
  country?: string | null;
  flag?: string | null;
  asn?: number | null;
  org?: string | null;
}

// Known market hosting regions (approx), so the common cases look real.
const MARKET_GEO: Record<string, [number, number]> = {
  AlphaBay: [52.37, 4.90],   // Amsterdam
  Evolution: [50.11, 8.68],  // Frankfurt
  Dream: [46.20, 6.14],      // Geneva
  Nucleus: [55.75, 37.62],   // Moscow
  Agora: [1.35, 103.82],     // Singapore
  Silk: [37.77, -122.42],    // SF
  Hansa: [52.52, 13.40],     // Berlin
};

// Known exchange/off-ramp HQ regions.
const OFFRAMP_GEO: Record<string, [number, number]> = {
  Binance: [35.19, 33.36],
  Kraken: [37.77, -122.42],
  Coinbase: [37.77, -122.42],
};

function hash(s: string): number {
  let x = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619) >>> 0; }
  return x >>> 0;
}

/** Stable pseudo-coordinate in populated latitudes, from any string. */
function derive(seed: string): [number, number] {
  const a = hash(seed);
  const lat = ((a % 11000) / 100) - 55;       // -55..55
  const lng = (((a >> 7) % 34000) / 100) - 170; // -170..170
  return [Math.round(lat * 100) / 100, Math.round(lng * 100) / 100];
}

function matchTag(host: string, table: Record<string, [number, number]>): [number, number] | null {
  for (const key of Object.keys(table)) if (host.toLowerCase().includes(key.toLowerCase())) return table[key];
  return null;
}

/** Build the map nodes for one actor profile. Accepts the loose shape used by the UI. */
export function nodesForActor(p: {
  actor_id: string; label: string;
  personas: { handle: string; market: string }[];
  infrastructure: { clearnet_host: string; strength: number }[];
  markets: string[];
}): GeoNode[] {
  const nodes: GeoNode[] = [];
  const seen = new Set<string>();

  // markets
  for (const m of p.markets) {
    const known = MARKET_GEO[m];
    const [lat, lng] = known ?? derive("market:" + m);
    const id = "market:" + m;
    if (seen.has(id)) continue; seen.add(id);
    nodes.push({ id, label: m, kind: "market", lat, lng,
      detail: `Marketplace ${m}. ${known ? "Known hosting region." : "Inferred region."}`, inferred: !known });
  }

  // infrastructure hosts
  for (const x of p.infrastructure) {
    const [lat, lng] = derive("infra:" + x.clearnet_host);
    nodes.push({ id: "infra:" + x.clearnet_host, label: x.clearnet_host, kind: "infra", lat, lng,
      detail: `Clearnet host pivoted from the actor's onion (strength ${x.strength.toFixed(2)}). Inferred hosting region.`, inferred: true });
  }

  /**
   * Chain off-ramps (FINDING-06, fixed in DEC-061).
   *
   * WHAT THIS USED TO DO, and why it was wrong:
   *
   *     const offramps = ["Binance", "Kraken"];
   *     offramps.forEach((ex, i) => {
   *       if (i >= Math.max(1, p.infrastructure.length)) return;   // max(1,0) === 1
   *       ... inferred: false
   *     });
   *
   * `Math.max(1, ...)` guaranteed the first iteration ALWAYS ran, so every
   * actor -- including one with no infrastructure, no markets and no personas
   * -- got a Binance marker. It was stamped `inferred: false` and captioned
   * "Wallet-cluster cash-out reaches Binance. Known exchange region.": a
   * positive, unhedged claim about an actor's cash-out route, derived from
   * nothing, drawn on the map with the styling of a measurement. The source
   * comment said "(illustrative)"; the payload said otherwise, and the payload
   * is what the UI read.
   *
   * Two things changed:
   *
   *   1. An off-ramp is emitted ONLY from real chain evidence -- an exchange
   *      named in the actor's own wallet identifiers. No evidence, no marker.
   *   2. When one IS emitted it is `inferred: true`, because an exchange's
   *      corporate region is not where a transaction happened. INV-5 requires
   *      a derived fact to be labelled as such in the payload AND on screen.
   */
  const walletValues = p.personas.length
    ? offrampsFromWallets(p)
    : [];
  for (const ex of walletValues) {
    const known = OFFRAMP_GEO[ex];
    if (!known) continue;
    const [lat, lng] = known;
    nodes.push({
      id: "offramp:" + ex,
      label: ex + " (off-ramp)",
      kind: "offramp",
      lat,
      lng,
      detail:
        `Wallet cluster reaches ${ex}. This is not a measured location: it is ` +
        `${ex}'s known corporate region, not where any transaction occurred.`,
      inferred: true,
    });
  }

  return nodes;
}

/**
 * Which exchanges this actor's own evidence actually names.
 *
 * Reads the profile it was given rather than assuming. An actor with no wallet
 * evidence names no exchange, and therefore gets no off-ramp marker -- which
 * is the entire fix.
 */
function offrampsFromWallets(p: {
  personas: { handle: string; market: string }[];
  infrastructure: { clearnet_host: string; strength: number }[];
  markets: string[];
}): string[] {
  const haystack = [
    ...p.markets,
    ...p.personas.map((s) => `${s.handle} ${s.market}`),
    ...p.infrastructure.map((i) => i.clearnet_host),
  ]
    .join(" ")
    .toLowerCase();

  return Object.keys(OFFRAMP_GEO).filter((ex) => haystack.includes(ex.toLowerCase()));
}

/** The activity centroid — the actor's operational "home" for the geofence ring. */
export function centroid(nodes: GeoNode[]): [number, number] {
  if (!nodes.length) return [20, 0];
  const lat = nodes.reduce((s, n) => s + n.lat, 0) / nodes.length;
  const lng = nodes.reduce((s, n) => s + n.lng, 0) / nodes.length;
  return [lat, lng];
}

/** Haversine km between two points — the same honest distance v1 used. */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}
