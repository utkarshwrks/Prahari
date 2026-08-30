"use client";

import { AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { useIntel } from "@/store/intel";
import { Intercept } from "@/lib/mockIntel";
import IntelCard from "../IntelCard";
import IntelDetailModal from "../IntelDetailModal";

export default function LiveIntelFeed() {
  const intercepts = useIntel((s) => s.intercepts);
  const [now, setNow] = useState<number>(() => Date.now());
  const [selected, setSelected] = useState<Intercept | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (intercepts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <Radio className="h-6 w-6 animate-pulseDot text-muted-2" />
        <div className="mono text-xs tracking-[0.2em] text-muted-2">
          AWAITING INTERCEPTS…
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Live intercept feed"
        className="slim-scroll h-full space-y-2 overflow-y-auto px-3 pb-3 pt-2"
      >
        <AnimatePresence initial={false}>
          {intercepts.map((i) => (
            <IntelCard key={i.id} intercept={i} now={now} onClick={() => setSelected(i)} />
          ))}
        </AnimatePresence>
      </div>
      {selected && <IntelDetailModal intercept={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
