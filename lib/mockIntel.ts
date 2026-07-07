// Synthetic dark-web intel generator. 100% offline — no network, no scraping,
// no real data. Listings are CATEGORY-LEVEL only (a contraband type + city +
// handle + wallet) — never any synthesis or how-to content. Entities are
// PRE-TAGGED deterministically at generation time, so the feed never needs a
// model to look intelligent.

import { ZONE_CITIES, OTHER_CITIES, isInJabalpurZone } from "./cities";

export type IntelSource = "Marketplace" | "Forum" | "Paste" | "Bridge";
export type Severity = "low" | "medium" | "high";
export type ContrabandCategory = "Drugs" | "Weapons" | "Data" | "Counterfeit";

export interface Entities {
  locations: string[];
  contraband: string[];
  wallets: string[];
  handles: string[];
}

export interface Intercept {
  id: string;
  source: IntelSource;
  timestamp: number;
  rawText: string;
  entities: Entities;
  severity: Severity;
  live?: boolean; // true when ingested from LIVE OSINT (not synthetic)
  channel?: string; // e.g. "Hacker News", "Reddit" — shown for live items
  url?: string; // source link for live items
}

// ---- Entity pools -----------------------------------------------------------

const CONTRABAND: Record<ContrabandCategory, string[]> = {
  Drugs: ["MDMA", "LSD", "mephedrone", "charas", "ketamine", "ganja", "cocaine"],
  Weapons: ["pistol parts", "weapon parts", "ammunition", "country-made katta", "air pistol"],
  Data: ["Aadhaar records", "PAN records", "credit-card dumps", "KYC data", "OTP logs"],
  Counterfeit: ["counterfeit currency", "fake stamp paper", "forged documents", "duplicate notes"],
};

const CONTRABAND_CATEGORY: Record<string, ContrabandCategory> = {};
(Object.keys(CONTRABAND) as ContrabandCategory[]).forEach((cat) => {
  CONTRABAND[cat].forEach((item) => {
    CONTRABAND_CATEGORY[item.toLowerCase()] = cat;
  });
});

export function categoryOf(item: string): ContrabandCategory | undefined {
  return CONTRABAND_CATEGORY[item.toLowerCase()];
}

export const CONTRABAND_CATEGORIES: ContrabandCategory[] = [
  "Drugs",
  "Weapons",
  "Data",
  "Counterfeit",
];

const HANDLES = [
  "@nightowl_mp", "@ironhand_", "@rupeeforge", "@gwalior_gun", "@data_baba",
  "@mp_supply", "@zeronet_", "@satna_source", "@indori_ice", "@bhopalbyte",
  "@cryptokaka", "@narmada_net",
];

// Small pool so addresses recur across listings → wallet-cluster correlation.
const WALLETS = [
  "bc1q7xk3f2m9v0", "1A1zP1eP5QGefi2", "3J98t1WpEZ73CN", "bc1qar0srrr7xfk",
  "1BvBMSEYstWetqT", "3FZbgi29cpjq2Gj", "bc1qxy2kgdygjrsq", "19kgqLJ7kN4hZ2f",
];

const SOURCES: IntelSource[] = ["Marketplace", "Forum", "Paste", "Bridge"];

// ---- Random helpers ---------------------------------------------------------

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const chance = (p: number): boolean => Math.random() < p;

let seq = 0;
const nextId = (): string =>
  `INT-${(++seq).toString().padStart(4, "0")}-${Math.floor(Math.random() * 46656)
    .toString(36)
    .toUpperCase()
    .padStart(3, "0")}`;

// ---- Templates --------------------------------------------------------------
// Source-prefixed, professional listing templates. Each picks a contraband
// category so the text is coherent and the entities are known exactly.

interface TemplateCtx {
  city: string | null;
  items: string[];
  handle: string | null;
  wallet: string | null;
}

type Template = {
  source: IntelSource;
  category: ContrabandCategory;
  render: (c: TemplateCtx) => string;
};

const loc = (city: string | null, withText: string, withoutText: string) =>
  city ? withText.replace("{city}", city) : withoutText;

const TEMPLATES: Template[] = [
  {
    source: "Marketplace",
    category: "Drugs",
    render: (c) =>
      `Marketplace listing: ${c.items.join(" & ")}, ` +
      loc(c.city, "delivery across {city}", "nationwide delivery") +
      `.${c.handle ? ` Contact ${c.handle}.` : ""}${c.wallet ? ` BTC ${c.wallet}…` : ""}`,
  },
  {
    source: "Marketplace",
    category: "Drugs",
    render: (c) =>
      `Marketplace listing: premium ${c.items.join(", ")} restock` +
      loc(c.city, " · {city} drop point", "") +
      `.${c.handle ? ` DM ${c.handle}.` : ""}${c.wallet ? ` Wallet ${c.wallet}…` : ""}`,
  },
  {
    source: "Forum",
    category: "Weapons",
    render: (c) =>
      `Forum post: ${c.items.join(", ")}, ` +
      loc(c.city, "discreet shipping to {city}", "discreet shipping") +
      `.${c.handle ? ` Signal handle ${c.handle}.` : ""}${c.wallet ? ` Escrow ${c.wallet}…` : ""}`,
  },
  {
    source: "Paste",
    category: "Data",
    render: (c) =>
      `Data dump: ~${(Math.floor(Math.random() * 90) + 10)}k ${c.items.join("+")}, ` +
      loc(c.city, "{city} region", "MP region") +
      `. ${(Math.random() * 0.8 + 0.1).toFixed(1)} BTC.${c.wallet ? ` Wallet ${c.wallet}…` : ""}`,
  },
  {
    source: "Bridge",
    category: "Data",
    render: (c) =>
      `Bridge intercept: ${c.items.join(", ")} for sale, ` +
      loc(c.city, "buyers near {city}", "PAN-India") +
      `.${c.handle ? ` ${c.handle}` : ""}${c.wallet ? ` · ${c.wallet}…` : ""}`,
  },
  {
    source: "Paste",
    category: "Counterfeit",
    render: (c) =>
      `Paste: ${c.items.join(", ")}, ` +
      loc(c.city, "pickup {city}", "cash-on-meet") +
      `.${c.handle ? ` ${c.handle}` : ""}${c.wallet ? ` wallet ${c.wallet}…` : ""}`,
  },
  {
    source: "Forum",
    category: "Counterfeit",
    render: (c) =>
      `Forum post: high-quality ${c.items.join(", ")} moving ` +
      loc(c.city, "through {city}", "interstate") +
      `.${c.handle ? ` Vouches: ${c.handle}.` : ""}`,
  },
];

// ---- Generator --------------------------------------------------------------

export interface GenerateOptions {
  forceCity?: string; // demo mode uses this to guarantee a zone breach
}

export function generateIntercept(opts: GenerateOptions = {}): Intercept {
  // ~32% zone city, ~48% other MP, ~20% none.
  let city: string | null;
  if (opts.forceCity) {
    city = opts.forceCity;
  } else {
    const roll = Math.random();
    if (roll < 0.32) city = pick(ZONE_CITIES);
    else if (roll < 0.8) city = pick(OTHER_CITIES);
    else city = null;
  }

  const template = pick(TEMPLATES);
  const catPool = CONTRABAND[template.category];
  const itemCount = chance(0.4) ? 2 : 1;
  const items: string[] = [];
  while (items.length < itemCount) {
    const it = pick(catPool);
    if (!items.includes(it)) items.push(it);
  }

  const handle = chance(0.72) ? pick(HANDLES) : null;
  const wallet = chance(0.62) ? pick(WALLETS) : null;

  const rawText = template.render({ city, items, handle, wallet });

  const severity: Severity = !city
    ? "low"
    : isInJabalpurZone(city)
      ? "high"
      : "medium";

  return {
    id: nextId(),
    source: template.source,
    timestamp: Date.now(),
    rawText,
    entities: {
      locations: city ? [city] : [],
      contraband: items,
      wallets: wallet ? [wallet] : [],
      handles: handle ? [handle] : [],
    },
    severity,
  };
}
