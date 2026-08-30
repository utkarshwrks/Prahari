"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Radio } from "lucide-react";

// Self-contained marketing preview — a live-looking intercept ticker for the
// hero. (The real engine lives in Phase 4; this is credibility chrome only.)
const LINES: { src: string; text: string; zone: boolean }[] = [
  { src: "MARKETPLACE", text: "MDMA & LSD · delivery across Jabalpur, Katni · @nightowl_mp", zone: true },
  { src: "PASTE", text: "~50k Aadhaar+PAN records · MP region (Bhopal, Indore) · 0.4 BTC", zone: false },
  { src: "FORUM", text: "weapon parts · discreet shipping to Gwalior · @ironhand_", zone: false },
  { src: "BRIDGE", text: "counterfeit currency · pickup Ujjain / Sagar · @rupeeforge", zone: false },
  { src: "MARKETPLACE", text: "ketamine restock · Narsinghpur drop point · wallet bc1q7x…", zone: true },
  { src: "FORUM", text: "KYC data dump · Rewa + Satna leads · wallet 1A1zP1eP…", zone: false },
];

export default function FeedTicker() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2200);
    return () => clearInterval(id);
  }, []);

  // rotate the window of visible lines
  const visible = Array.from({ length: 4 }, (_, i) => LINES[(tick + i) % LINES.length]);

  return (
    <div className="panel brackets w-full">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 animate-pulseDot text-red-bright" />
          <span className="mono text-[10px] uppercase tracking-[0.2em] text-muted">
            Live Intel Feed
          </span>
        </div>
        <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-2">
          ● SYNTHETIC
        </span>
      </div>
      <div className="red-rule opacity-70" />
      <div className="space-y-1.5 p-3">
        {visible.map((l, i) => (
          <motion.div
            key={`${tick}-${i}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: i === 0 ? 1 : 0.55 - i * 0.1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="flex items-start gap-2 border-l-2 pl-2"
            style={{ borderColor: l.zone ? "#FF2A1F" : "#3A3A40" }}
          >
            <span
              className={`mono mt-0.5 shrink-0 border px-1 py-0.5 text-[8px] tracking-wider ${
                l.zone
                  ? "border-red/50 bg-red/10 text-red-bright"
                  : "border-border-2 text-muted-2"
              }`}
            >
              {l.src}
            </span>
            <span className="mono text-[11px] leading-tight text-muted">
              {l.text}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
