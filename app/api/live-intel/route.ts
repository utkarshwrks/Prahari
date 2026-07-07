import { NextResponse } from "next/server";
import { INDIA_CITY_NAMES } from "@/lib/indiaCities";
import { isInJabalpurZone } from "@/lib/cities";

export const dynamic = "force-dynamic";

// LIVE OSINT: pull REAL public cyber-threat items from free, no-key sources
// (Hacker News Algolia + Reddit), run lightweight NER, geofence Indian cities.
// This is legal open-source intelligence — NOT dark-web scraping. In production
// the same pipeline accepts a licensed dark-web content feed.

interface LiveItem {
  id: string;
  source: "Forum" | "Paste" | "Bridge" | "Marketplace";
  channel: string;
  url?: string;
  timestamp: number;
  rawText: string;
  entities: { locations: string[]; contraband: string[]; wallets: string[]; handles: string[] };
  severity: "low" | "medium" | "high";
  live: true;
}

const THREAT_KEYWORDS = [
  "ransomware", "data breach", "breach", "phishing", "malware", "stolen data",
  "leaked", "leak", "hacked", "hack", "fraud", "scam", "stolen", "credentials",
  "dark web", "darkweb", "trafficking", "narcotics", "counterfeit", "extortion",
  "ddos", "botnet", "spyware", "identity theft", "cyber", "exploit", "zero-day",
];

const HANDLE_RE = /@[a-zA-Z0-9_]{2,}/g;
const WALLET_RE = /\b(?:bc1[ac-hj-np-z0-9]{6,}|[13][a-km-zA-HJ-NP-Z1-9]{20,}|0x[a-fA-F0-9]{40})\b/g;

const dedupe = (a: string[]) => Array.from(new Set(a));

function extract(text: string) {
  const lower = text.toLowerCase();
  const locations = INDIA_CITY_NAMES.filter((n) =>
    new RegExp(`\\b${n.toLowerCase()}\\b`).test(lower)
  );
  const contraband = dedupe(THREAT_KEYWORDS.filter((k) => lower.includes(k))).slice(0, 4);
  const handles = dedupe(text.match(HANDLE_RE) ?? []).slice(0, 3);
  const wallets = dedupe(text.match(WALLET_RE) ?? []).slice(0, 3);
  return { locations: dedupe(locations), contraband, wallets, handles };
}

function severityFor(locations: string[]): "low" | "medium" | "high" {
  if (locations.some((c) => isInJabalpurZone(c))) return "high";
  if (locations.length > 0) return "medium";
  return "low";
}

async function fetchJSON(url: string, headers?: Record<string, string>) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", ...(headers ?? {}) },
    signal: AbortSignal.timeout(5500),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

const HN_QUERIES = [
  "dark web", "cybercrime", "data breach", "ransomware", "phishing",
  "India cyber", "India data breach", "India scam", "cyber fraud India", "stolen data",
];

// relevance: keep only items that actually look security-related or name a place
const isRelevant = (e: LiveItem["entities"]) => e.contraband.length > 0 || e.locations.length > 0;

async function hnQuery(q: string): Promise<LiveItem[]> {
  const data = await fetchJSON(
    `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=20`
  );
  const hits = Array.isArray(data?.hits) ? data.hits : [];
  return hits
    .filter((h: { title?: string }) => h.title)
    .map((h: { objectID: string; title: string; url?: string; created_at_i: number }) => {
      const entities = extract(h.title);
      return {
        id: `hn-${h.objectID}`,
        source: "Forum" as const,
        channel: "Hacker News",
        url: h.url,
        timestamp: (h.created_at_i ?? Date.now() / 1000) * 1000,
        rawText: `[OSINT] ${h.title}`,
        entities,
        severity: severityFor(entities.locations),
        live: true as const,
      };
    })
    .filter((it: LiveItem) => isRelevant(it.entities));
}

async function fromHackerNews(): Promise<LiveItem[]> {
  // two distinct random queries for variety + volume
  const pool = [...HN_QUERIES];
  const q1 = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  const q2 = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  const settled = await Promise.allSettled([hnQuery(q1), hnQuery(q2)]);
  const out: LiveItem[] = [];
  const seen = new Set<string>();
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const it of r.value) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      out.push(it);
    }
  }
  return out;
}

async function fromReddit(): Promise<LiveItem[]> {
  const subs = ["cybersecurity", "netsec"];
  const sub = subs[Math.floor(Math.random() * subs.length)];
  const data = await fetchJSON(`https://www.reddit.com/r/${sub}/new.json?limit=25`, {
    "User-Agent": "PRAHARI-OSINT/1.0 (threat-intel demo)",
  });
  const posts = data?.data?.children ?? [];
  return posts
    .map((p: { data?: { id: string; title: string; permalink: string; created_utc: number } }) => p.data)
    .filter((d: { title?: string } | undefined) => d?.title)
    .map((d: { id: string; title: string; permalink: string; created_utc: number }) => {
      const rawText = `[OSINT] ${d.title}`;
      const entities = extract(d.title);
      return {
        id: `rd-${d.id}`,
        source: "Bridge" as const,
        channel: `r/${sub}`,
        url: `https://reddit.com${d.permalink}`,
        timestamp: (d.created_utc ?? Date.now() / 1000) * 1000,
        rawText,
        entities,
        severity: severityFor(entities.locations),
        live: true as const,
      };
    })
    .filter((it: LiveItem) => isRelevant(it.entities));
}

const GNEWS_QUERIES = [
  "cyber crime Madhya Pradesh",
  "cyber fraud India police",
  "online scam India arrest",
  "cyber crime Jabalpur OR Bhopal OR Indore OR Gwalior",
  "dark web India",
  "data breach India",
];

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .trim();
}

async function fromGoogleNews(): Promise<LiveItem[]> {
  const q = GNEWS_QUERIES[Math.floor(Math.random() * GNEWS_QUERIES.length)];
  const res = await fetch(
    `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`,
    { headers: { "User-Agent": "PRAHARI-OSINT/1.0" }, signal: AbortSignal.timeout(5500), cache: "no-store" }
  );
  if (!res.ok) throw new Error(`gnews ${res.status}`);
  const xml = await res.text();
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const out: LiveItem[] = [];
  for (const it of items.slice(0, 25)) {
    const rawTitle = it.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "";
    const title = decodeEntities(rawTitle).replace(/\s+-\s+[^-]+$/, ""); // drop " - Publisher"
    const link = (it.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "").trim();
    const pub = it.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
    if (!title) continue;
    const entities = extract(title);
    out.push({
      id: `gn-${Buffer.from(link || title).toString("base64").slice(0, 18)}`,
      source: "Paste",
      channel: "Google News",
      url: link,
      timestamp: pub ? Date.parse(pub) : Date.now(),
      rawText: `[OSINT] ${title}`,
      entities,
      severity: severityFor(entities.locations),
      live: true,
    });
  }
  return out.filter((it) => isRelevant(it.entities));
}

// Small in-memory cache to avoid hammering upstream (news changes slowly).
let cache: { ts: number; items: LiveItem[] } | null = null;
const TTL = 20_000;

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) {
    return NextResponse.json({ ok: true, cached: true, items: cache.items });
  }

  const settled = await Promise.allSettled([fromHackerNews(), fromGoogleNews(), fromReddit()]);
  const items: LiveItem[] = [];
  for (const r of settled) if (r.status === "fulfilled") items.push(...r.value);

  // newest first, cap
  items.sort((a, b) => b.timestamp - a.timestamp);
  const sources = settled.filter((s) => s.status === "fulfilled").length;

  if (items.length === 0) {
    return NextResponse.json(
      { ok: false, sources, items: [], note: "No live OSINT reachable (offline?)." },
      { status: 200 }
    );
  }

  cache = { ts: Date.now(), items: items.slice(0, 40) };
  return NextResponse.json({ ok: true, sources, items: cache.items });
}
