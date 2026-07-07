"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Loader2, ScanSearch, MapPin, Flag, Bitcoin, AtSign } from "lucide-react";
import { useIntel } from "@/store/intel";
import TacticalPanel from "../../ui/TacticalPanel";

const SAMPLE =
  "Marketplace listing: MDMA & LSD, delivery across Jabalpur and Katni. Contact @nightowl_mp. BTC bc1q7xk3f2m9v0";

interface Extracted {
  locations: string[];
  contraband: string[];
  crypto_wallets: string[];
  handles: string[];
}

export default function LiveNERAnalyzer() {
  const [text, setText] = useState(SAMPLE);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ entities: Extracted; source: string } | null>(null);
  const registerCities = useIntel((s) => s.registerCities);

  async function onAnalyze() {
    if (!text.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult({ entities: data.entities, source: data.source });
        if (data.entities.locations?.length) {
          registerCities(data.entities.locations, "analysis");
        }
      }
    } catch {
      // network failure — API always available locally, so this is rare
    } finally {
      setLoading(false);
    }
  }

  const e = result?.entities;
  const groups = e
    ? [
        { items: e.locations, icon: MapPin, cls: "border-red/50 bg-red/10 text-red-bright" },
        { items: e.contraband, icon: Flag, cls: "border-border-2 bg-panel-2 text-text" },
        { items: e.crypto_wallets, icon: Bitcoin, cls: "border-border-2 bg-panel-2 text-muted" },
        { items: e.handles, icon: AtSign, cls: "border-white/20 bg-white/[0.03] text-text" },
      ]
    : [];
  const total = e
    ? e.locations.length + e.contraband.length + e.crypto_wallets.length + e.handles.length
    : 0;

  return (
    <TacticalPanel title="Live NER Analyzer" live>
      <div className="p-3">
        <div className="mono mb-2 text-[10px] leading-snug text-muted-2">
          Paste marketplace / forum text → extract entities → plot MP cities live.
        </div>
        <textarea
          value={text}
          onChange={(ev) => setText(ev.target.value)}
          rows={3}
          spellCheck={false}
          placeholder="Paste text to analyze…"
          className="field mono slim-scroll resize-none text-[12px]"
        />
        <button
          onClick={onAnalyze}
          disabled={loading || !text.trim()}
          className="btn btn-primary mt-2 w-full !py-2.5"
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing…
            </>
          ) : (
            <>
              <ScanSearch className="h-3.5 w-3.5" /> Analyze
            </>
          )}
        </button>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 flex items-center justify-between">
                <span className="mono text-[9px] tracking-[0.14em] text-muted-2">
                  {total} ENTIT{total === 1 ? "Y" : "IES"} EXTRACTED
                </span>
                <span
                  className={`mono border px-1.5 py-0.5 text-[9px] tracking-widest ${
                    result.source === "groq"
                      ? "border-red/50 text-red-bright"
                      : "border-border text-muted-2"
                  }`}
                >
                  {result.source === "groq" ? "via Groq" : "via local engine"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {total === 0 && (
                  <span className="mono text-[10px] text-muted-2">— no entities detected —</span>
                )}
                {groups.flatMap((g) =>
                  g.items.map((it) => {
                    const Icon = g.icon;
                    return (
                      <span
                        key={`${g.cls}-${it}`}
                        className={`mono inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] ${g.cls}`}
                      >
                        <Icon className="h-3 w-3" />
                        {it.length > 18 ? `${it.slice(0, 8)}…${it.slice(-4)}` : it}
                      </span>
                    );
                  })
                )}
              </div>
              {e && e.locations.length > 0 && (
                <div className="mono mt-2 text-[9px] tracking-widest text-red-bright">
                  ↳ {e.locations.length} location(s) plotted on map
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TacticalPanel>
  );
}
