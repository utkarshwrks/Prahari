"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const ITEMS = [
  {
    q: "Can PRAHARI deanonymize Tor or geolocate a hidden service?",
    a: "No — and it never claims to. Tor is anonymous by design. PRAHARI reads the public content of criminal listings and geofences on the real-world locations the sellers state themselves. It is content-based geospatial intelligence, not network deanonymization.",
  },
  {
    q: "Is the data real?",
    a: "No. All intercepts in this build are synthetic, generated locally at the category level (a contraband type + a city + a handle + a wallet). There is no real dark-web access, no Tor connection and no scraping. Everything downstream of ingestion is production-identical — going live is a single source swap.",
  },
  {
    q: "What if a listing doesn't mention a location?",
    a: "A marketplace must advertise where it ships, so location leakage is intrinsic to the content. Listings without a location simply carry low severity and don't trigger the geofence; we still capture their wallets and handles for correlation.",
  },
  {
    q: "Is any of this illegal or privacy-invading?",
    a: "No. We read public criminal-market content, not private citizens' communications. There is no interception and no deanonymization. Every lead is auditable and traceable to its public source.",
  },
  {
    q: "Does it really run for free?",
    a: "Yes. The core app runs with just `npm install && npm run dev` — no accounts, no paid services. The Live NER analyzer optionally uses a free Groq API tier, and falls back to a built-in local extractor when there's no key, so the whole platform works at $0.",
  },
  {
    q: "How does it scale beyond Jabalpur?",
    a: "The geofence and gazetteer are configuration, not code. Jabalpur is the pilot; adding a district is a data change. A state control room runs the MP-wide view while each cell runs its own local geofence.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-border border border-border">
      {ITEMS.map((it, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-panel-2/50"
            >
              <span className="font-heading text-base font-medium text-text">
                {it.q}
              </span>
              {isOpen ? (
                <Minus className="h-4 w-4 shrink-0 text-red-bright" />
              ) : (
                <Plus className="h-4 w-4 shrink-0 text-muted" />
              )}
            </button>
            {isOpen && (
              <div className="px-4 pb-4 text-sm leading-relaxed text-muted">
                {it.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
