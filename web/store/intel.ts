import { create } from "zustand";
import {
  generateIntercept,
  Intercept,
  ContrabandCategory,
  categoryOf,
  IntelSource,
  Severity,
} from "@/lib/mockIntel";
import { isInJabalpurZone, getCity, getAnyCity, haversineKm, JABALPUR } from "@/lib/cities";

const MAX_INTERCEPTS = 60;
const CRITICAL_DECAY_MS = 30_000; // CRITICAL persists ~30s after last zone breach
const ELEVATED_DECAY_MS = 15_000; // ELEVATED persists ~15s after last MP mention

export type ThreatLevel = "NOMINAL" | "ELEVATED" | "CRITICAL";

export interface MapPulse {
  seq: number;
  city: string;
  lat: number;
  lng: number;
  breach: boolean;
  source: "feed" | "analysis";
}

export interface BreachEvent {
  seq: number;
  city: string;
  at: number;
}

/** A request for the map to fly to a specific location (set when the user
 *  clicks an alert / city). */
export interface FocusTarget {
  seq: number;
  city: string;
  lat: number;
  lng: number;
}

export type LiveStatus = "idle" | "connecting" | "live" | "offline";

/** Feed source. DEMO is synthetic, DATASET is the engine's real listings,
 *  LIVE is public OSINT. Replaces v1's `demoMode` boolean (Phase 2 obj 6). */
export type FeedMode = "DEMO" | "DATASET" | "LIVE";

export const FEED_MODES: FeedMode[] = ["DEMO", "DATASET", "LIVE"];

export type AlertStatus = "New" | "Acknowledged" | "Investigating" | "Closed";

export interface AlertLogEntry {
  id: string;
  city: string;
  source: IntelSource | "NER";
  severity: Severity;
  timestamp: number;
  lat: number;
  lng: number;
  distanceKm: number; // from Jabalpur centre
  rawText: string; // the intercept / analysed text
  status: AlertStatus;
  assignee?: string;
  note?: string;
  read: boolean;
  live?: boolean;
  channel?: string; // e.g. "Hacker News" for live OSINT
  url?: string; // source article link for live items
}

interface IntelState {
  intercepts: Intercept[];
  running: boolean;
  mode: FeedMode;
  muted: boolean;
  toastsEnabled: boolean;
  liveStatus: LiveStatus;
  /** Why DATASET mode is empty, when it is. Null means no problem to report. */
  datasetNotice: string | null;
  focusTarget: FocusTarget | null;

  totalIntercepts: number;
  geofenceBreaches: number;
  walletsTracked: number;
  handlesFlagged: number;

  threatLevel: ThreatLevel;
  lastBreachAt: number | null;
  lastMpAt: number | null;
  lastPulse: MapPulse | null;
  lastBreach: BreachEvent | null;

  cityHeat: Record<string, number>;
  alertLog: AlertLogEntry[];

  start: () => void;
  stop: () => void;
  setMode: (mode: FeedMode) => void;
  toggleMute: () => void;
  toggleToasts: () => void;
  focusOnCity: (city: string) => void;
  ingest: (i: Intercept) => void;
  registerCities: (cities: string[], source: "feed" | "analysis") => void;

  // alert management (MP Cyber Cell tools)
  setAlertStatus: (id: string, status: AlertStatus) => void;
  assignAlert: (id: string, assignee: string) => void;
  noteAlert: (id: string, note: string) => void;
  markAllAlertsRead: () => void;
}

// module-level timers & dedup sets (not reactive state)
let streamTimer: ReturnType<typeof setTimeout> | null = null;
let threatTimer: ReturnType<typeof setInterval> | null = null;
let demoTimers: ReturnType<typeof setTimeout>[] = [];
let pulseSeq = 0;
let breachSeq = 0;
let focusSeq = 0;
const walletSet = new Set<string>();
const handleSet = new Set<string>();
const liveSeen = new Set<string>(); // dedup for LIVE OSINT items
const datasetSeen = new Set<string>(); // dedup for DATASET engine items

function computeThreat(
  lastBreachAt: number | null,
  lastMpAt: number | null
): ThreatLevel {
  const now = Date.now();
  if (lastBreachAt && now - lastBreachAt < CRITICAL_DECAY_MS) return "CRITICAL";
  if (lastMpAt && now - lastMpAt < ELEVATED_DECAY_MS) return "ELEVATED";
  return "NOMINAL";
}

export const useIntel = create<IntelState>((set, get) => ({
  intercepts: [],
  running: false,
  mode: "DEMO",
  muted: true,
  toastsEnabled: true,
  liveStatus: "idle",
  datasetNotice: null,
  focusTarget: null,

  totalIntercepts: 0,
  geofenceBreaches: 0,
  walletsTracked: 0,
  handlesFlagged: 0,

  threatLevel: "NOMINAL",
  lastBreachAt: null,
  lastMpAt: null,
  lastPulse: null,
  lastBreach: null,

  cityHeat: {},
  alertLog: [],

  ingest: (i: Intercept) => {
    const s = get();
    i.entities.wallets.forEach((w) => walletSet.add(w));
    i.entities.handles.forEach((h) => handleSet.add(h));

    let breaches = s.geofenceBreaches;
    let lastBreachAt = s.lastBreachAt;
    let lastMpAt = s.lastMpAt;
    let lastPulse = s.lastPulse;
    let lastBreach = s.lastBreach;
    const cityHeat = { ...s.cityHeat };
    const newAlerts: AlertLogEntry[] = [];

    for (const cityName of i.entities.locations) {
      const city = getAnyCity(cityName);
      if (!city) continue;
      const breach = isInJabalpurZone(cityName);
      lastMpAt = i.timestamp;
      cityHeat[cityName] = (cityHeat[cityName] ?? 0) + (breach ? 2 : 1);
      lastPulse = {
        seq: ++pulseSeq,
        city: cityName,
        lat: city.lat,
        lng: city.lng,
        breach,
        source: "feed",
      };
      if (breach) {
        breaches += 1;
        lastBreachAt = i.timestamp;
        lastBreach = { seq: ++breachSeq, city: cityName, at: i.timestamp };
        newAlerts.push({
          id: `${i.id}-${cityName}`,
          city: cityName,
          source: i.source,
          severity: i.severity,
          timestamp: i.timestamp,
          lat: city.lat,
          lng: city.lng,
          distanceKm: Math.round(haversineKm(JABALPUR, city)),
          rawText: i.rawText,
          status: "New",
          read: false,
          live: i.live,
          channel: i.channel,
          url: i.url,
        });
      } else if (i.live && getCity(cityName)) {
        // LIVE mode: a real OSINT item naming another monitored MP city →
        // a realtime "regional watch" alert (not an in-zone breach).
        newAlerts.push({
          id: `${i.id}-${cityName}`,
          city: cityName,
          source: i.source,
          severity: "medium",
          timestamp: i.timestamp,
          lat: city.lat,
          lng: city.lng,
          distanceKm: Math.round(haversineKm(JABALPUR, city)),
          rawText: i.rawText,
          status: "New",
          read: false,
          live: i.live,
          channel: i.channel,
          url: i.url,
        });
      }
    }

    const intercepts = [i, ...s.intercepts].slice(0, MAX_INTERCEPTS);
    const alertLog = [...newAlerts, ...s.alertLog].slice(0, 200);

    set({
      intercepts,
      totalIntercepts: s.totalIntercepts + 1,
      geofenceBreaches: breaches,
      walletsTracked: walletSet.size,
      handlesFlagged: handleSet.size,
      lastBreachAt,
      lastMpAt,
      lastPulse,
      lastBreach,
      cityHeat,
      alertLog,
      threatLevel: computeThreat(lastBreachAt, lastMpAt),
    });
  },

  registerCities: (cities, sourceKind) => {
    const s = get();
    let breaches = s.geofenceBreaches;
    let lastBreachAt = s.lastBreachAt;
    let lastMpAt = s.lastMpAt;
    let lastPulse = s.lastPulse;
    let lastBreach = s.lastBreach;
    const cityHeat = { ...s.cityHeat };
    const newAlerts: AlertLogEntry[] = [];
    const now = Date.now();

    for (const cityName of cities) {
      const city = getAnyCity(cityName);
      if (!city) continue;
      const breach = isInJabalpurZone(cityName);
      lastMpAt = now;
      cityHeat[cityName] = (cityHeat[cityName] ?? 0) + (breach ? 2 : 1);
      lastPulse = {
        seq: ++pulseSeq,
        city: cityName,
        lat: city.lat,
        lng: city.lng,
        breach,
        source: sourceKind,
      };
      if (breach) {
        breaches += 1;
        lastBreachAt = now;
        lastBreach = { seq: ++breachSeq, city: cityName, at: now };
        newAlerts.push({
          id: `ner-${now}-${cityName}`,
          city: cityName,
          source: "NER",
          severity: "high",
          timestamp: now,
          lat: city.lat,
          lng: city.lng,
          distanceKm: Math.round(haversineKm(JABALPUR, city)),
          rawText: `Manual NER analysis flagged an in-zone mention of ${cityName}.`,
          status: "New",
          read: false,
        });
      }
    }

    set({
      geofenceBreaches: breaches,
      lastBreachAt,
      lastMpAt,
      lastPulse,
      lastBreach,
      cityHeat,
      alertLog: [...newAlerts, ...s.alertLog].slice(0, 200),
      threatLevel: computeThreat(lastBreachAt, lastMpAt),
    });
  },

  start: () => {
    if (get().running) return;

    // LIVE mode: pull real public OSINT from the server route and ingest a few
    // fresh items per poll so the feed streams with real internet data.
    const fetchLiveBatch = async () => {
      try {
        if (get().liveStatus !== "live") set({ liveStatus: "connecting" });
        const res = await fetch("/api/live-intel");
        if (!res.ok) throw new Error("bad status");
        const data = await res.json();
        const items: Intercept[] = Array.isArray(data.items) ? data.items : [];
        let added = 0;
        for (const it of items) {
          if (liveSeen.has(it.id)) continue;
          liveSeen.add(it.id);
          get().ingest({ ...it, timestamp: Date.now() });
          if (++added >= 4) break; // stream a few at a time
        }
        set({ liveStatus: "live" });
      } catch {
        set({ liveStatus: "offline" });
      }
    };

    // DATASET mode: pull real listings from the engine through the server-side
    // proxy. The engine being down is a normal state, not an error - the feed
    // simply stays empty and the badge says why.
    const fetchDatasetBatch = async () => {
      try {
        const res = await fetch("/api/engine/feed?limit=20");
        const data = await res.json();
        if (data?.engine === "offline") {
          set({ datasetNotice: data.detail ?? "Engine offline.", liveStatus: "offline" });
          return;
        }
        const items: Intercept[] = Array.isArray(data?.items) ? data.items : [];
        let added = 0;
        for (const it of items) {
          if (datasetSeen.has(it.id)) continue;
          datasetSeen.add(it.id);
          get().ingest({ ...it, timestamp: Date.now() });
          if (++added >= 4) break;
        }
        set({
          liveStatus: "live",
          datasetNotice: items.length === 0 ? (data?.detail ?? null) : null,
        });
      } catch {
        set({ liveStatus: "offline", datasetNotice: "Engine unreachable." });
      }
    };

    const tick = async () => {
      const mode = get().mode;
      if (mode === "DEMO") {
        get().ingest(generateIntercept());
      } else if (mode === "DATASET") {
        await fetchDatasetBatch();
      } else {
        await fetchLiveBatch();
      }
      // Synthetic data streams fast; real sources are polled politely.
      const delay = mode === "DEMO" ? 900 + Math.random() * 600 : 9000 + Math.random() * 4000;
      streamTimer = setTimeout(tick, delay);
    };

    // First item quickly.
    streamTimer = setTimeout(tick, 500);

    threatTimer = setInterval(() => {
      const s = get();
      const next = computeThreat(s.lastBreachAt, s.lastMpAt);
      if (next !== s.threatLevel) set({ threatLevel: next });
    }, 1000);

    // DEMO MODE: guarantee two in-zone breaches early (~6s and ~15s).
    if (get().mode === "DEMO") {
      demoTimers.push(setTimeout(() => get().ingest(generateIntercept({ forceCity: "Jabalpur" })), 6000));
      demoTimers.push(setTimeout(() => get().ingest(generateIntercept({ forceCity: "Katni" })), 15000));
    }

    set({ running: true, liveStatus: get().mode === "DEMO" ? "idle" : "connecting" });
  },

  stop: () => {
    if (streamTimer) clearTimeout(streamTimer);
    if (threatTimer) clearInterval(threatTimer);
    demoTimers.forEach(clearTimeout);
    streamTimer = null;
    threatTimer = null;
    demoTimers = [];
    set({ running: false, liveStatus: "idle" });
  },

  setMode: (mode) => {
    // Identical semantics to v1's setDemoMode(): clear the feed and the map so
    // the new source starts clean, but KEEP the cumulative counters and the
    // alert log, because those are the record. The dedup Sets live outside
    // zustand (INV-5) which is what makes the counters cumulative.
    if (get().mode === mode) return;
    liveSeen.clear();
    datasetSeen.clear();
    set({
      mode,
      liveStatus: mode === "DEMO" ? "idle" : "connecting",
      datasetNotice: null,
      intercepts: [],
      cityHeat: {},
      lastPulse: null,
      lastBreach: null,
      lastBreachAt: null,
      lastMpAt: null,
      threatLevel: "NOMINAL",
    });
  },
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  toggleToasts: () => set((s) => ({ toastsEnabled: !s.toastsEnabled })),
  focusOnCity: (city) => {
    const c = getAnyCity(city);
    if (!c) return;
    set({ focusTarget: { seq: ++focusSeq, city, lat: c.lat, lng: c.lng } });
  },

  setAlertStatus: (id, status) =>
    set((s) => ({
      alertLog: s.alertLog.map((a) =>
        a.id === id ? { ...a, status, read: true } : a
      ),
    })),
  assignAlert: (id, assignee) =>
    set((s) => ({
      alertLog: s.alertLog.map((a) => (a.id === id ? { ...a, assignee } : a)),
    })),
  noteAlert: (id, note) =>
    set((s) => ({
      alertLog: s.alertLog.map((a) => (a.id === id ? { ...a, note } : a)),
    })),
  markAllAlertsRead: () =>
    set((s) => ({ alertLog: s.alertLog.map((a) => ({ ...a, read: true })) })),
}));

// ---- Derived selectors ------------------------------------------------------

export function selectCategoryBreakdown(
  intercepts: Intercept[]
): Record<ContrabandCategory, number> {
  const out: Record<ContrabandCategory, number> = {
    Drugs: 0,
    Weapons: 0,
    Data: 0,
    Counterfeit: 0,
  };
  for (const i of intercepts) {
    for (const item of i.entities.contraband) {
      const cat = categoryOf(item);
      if (cat) out[cat] += 1;
    }
  }
  return out;
}
