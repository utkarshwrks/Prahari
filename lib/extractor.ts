// Entity extraction for the LIVE NER ANALYZER. Runs SERVER-SIDE (see
// app/api/analyze/route.ts) so the Groq key never reaches the browser.
// Primary path: Groq NER (if GROQ_API_KEY is set). Fallback: local regex +
// gazetteer. The analyzer MUST always return results.

import { CITIES } from "./cities";

export interface Extracted {
  locations: string[];
  contraband: string[];
  crypto_wallets: string[];
  handles: string[];
}

export type ExtractSource = "groq" | "local";

export interface AnalyzeResult {
  entities: Extracted;
  source: ExtractSource;
}

const CITY_NAMES = CITIES.map((c) => c.name);

const CONTRABAND_KEYWORDS = [
  "mdma", "lsd", "mephedrone", "charas", "ganja", "ketamine", "cocaine",
  "heroin", "hashish", "meth", "narcotics", "drugs",
  "pistol", "pistol parts", "weapon parts", "ammunition", "katta", "firearm",
  "air pistol", "rifle", "weapon", "arms",
  "aadhaar", "aadhaar records", "pan", "pan records", "credit-card dumps",
  "credit card", "card dumps", "kyc", "kyc data", "otp", "otp logs",
  "database", "data dump", "records",
  "counterfeit currency", "counterfeit", "fake stamp paper", "stamp paper",
  "forged documents", "forged", "duplicate notes", "fake currency", "fake notes",
];

const dedupe = (arr: string[]) => Array.from(new Set(arr));

/** Offline extractor — deterministic regex + gazetteer matching. */
export function localExtract(text: string): Extracted {
  const lower = text.toLowerCase();

  const locations = CITY_NAMES.filter((name) =>
    new RegExp(`\\b${name.toLowerCase()}\\b`).test(lower)
  );

  const contraband = dedupe(CONTRABAND_KEYWORDS.filter((kw) => lower.includes(kw))).filter(
    (kw, _i, all) =>
      !all.some((other) => other !== kw && other.includes(kw) && lower.includes(other))
  );

  const handles = dedupe(text.match(/@[a-zA-Z0-9_]{2,}/g) ?? []);

  const btc =
    text.match(/\b(?:bc1[ac-hj-np-z0-9]{6,}|[13][a-km-zA-HJ-NP-Z1-9]{20,})\b/g) ?? [];
  const eth = text.match(/\b0x[a-fA-F0-9]{40}\b/g) ?? [];
  const crypto_wallets = dedupe([...btc, ...eth]);

  return { locations, contraband, crypto_wallets, handles };
}

const GROQ_SYSTEM =
  "You are an NER engine. From the user text, return ONLY minified JSON with keys locations, contraband, crypto_wallets, handles. No prose.";

async function groqExtract(text: string, apiKey: string): Promise<Extracted> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      messages: [
        { role: "system", content: GROQ_SYSTEM },
        { role: "user", content: text },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  const match = content.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match ? match[0] : content);
  const asArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  return {
    locations: asArr(parsed.locations),
    contraband: asArr(parsed.contraband),
    crypto_wallets: asArr(parsed.crypto_wallets),
    handles: asArr(parsed.handles),
  };
}

/** Analyze text server-side. Uses Groq when GROQ_API_KEY is present, else the
 *  local extractor. Never throws — always resolves with a usable result. */
export async function analyze(text: string): Promise<AnalyzeResult> {
  const key = process.env.GROQ_API_KEY;
  if (key && key.trim()) {
    try {
      const entities = await groqExtract(text, key.trim());
      return { entities, source: "groq" };
    } catch {
      // fall through to local
    }
  }
  return { entities: localExtract(text), source: "local" };
}
