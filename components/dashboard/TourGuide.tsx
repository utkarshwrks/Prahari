"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ArrowRight, ArrowLeft, PlayCircle, Sparkles } from "lucide-react";

const STORAGE_KEY = "prahari_tour_v1_done";
export const START_TOUR_EVENT = "prahari:start-tour";

interface Step {
  target?: string; // data-tour value; undefined = centered welcome/finish
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: "Welcome to PRAHARI",
    body: "This is your dark-web threat control room for Jabalpur. In 8 quick steps we'll show you what every part does. You can skip anytime.",
  },
  {
    target: "feed",
    title: "1 · Live Intel Feed",
    body: "New dark-web listings stream in here, newest first. Each one is auto-tagged with the city, contraband, wallet and handle it mentions.",
  },
  {
    target: "map",
    title: "2 · Geospatial Command",
    body: "The map of Madhya Pradesh. The red rings around Jabalpur are the geofence. When a listing names a city inside them, that spot sirens red.",
  },
  {
    target: "threat",
    title: "3 · Threat Level",
    body: "Your live risk gauge. It rises to ELEVATED on any MP mention and CRITICAL right after an in-zone Jabalpur breach, then calms down.",
  },
  {
    target: "ner",
    title: "4 · Live NER Analyzer",
    body: "Paste ANY sentence and press Analyze. PRAHARI pulls out the entities and drops the mentioned MP cities on the map — try it live in a demo.",
  },
  {
    target: "analytics",
    title: "5 · Threat Analytics",
    body: "The numbers: total intercepts, breaches, tracked wallets and flagged handles, plus a contraband breakdown and an activity graph.",
  },
  {
    target: "bell",
    title: "6 · Notifications & Case Tools",
    body: "The bell shows unread breach alerts. Open it to read each alert, set a status (Acknowledged / Investigating / Closed), assign an officer and add a note.",
  },
  {
    target: "demo",
    title: "7 · Demo Mode",
    body: "Keep this ON for a pitch — it speeds up the feed and guarantees a Jabalpur breach within 20 seconds, every run. Turn it off for a calmer, realistic pace.",
  },
  {
    title: "You're ready",
    body: "That's the whole console. A guaranteed breach is about to fire — watch the map. You can replay this tour anytime from the user menu.",
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export default function TourGuide() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // auto-start on first visit; also listen for manual replay
  useEffect(() => {
    if (typeof window === "undefined") return;
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      const t = setTimeout(() => {
        setStep(0);
        setActive(true);
      }, 900);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      setStep(0);
      setActive(true);
    };
    window.addEventListener(START_TOUR_EVENT, handler);
    return () => window.removeEventListener(START_TOUR_EVENT, handler);
  }, []);

  const computeRect = useCallback(() => {
    const target = STEPS[step]?.target;
    if (!target) {
      setRect(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useLayoutEffect(() => {
    if (!active) return;
    computeRect();
    const onResize = () => computeRect();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [active, step, computeRect]);

  const finish = useCallback(() => {
    setActive(false);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, "1");
  }, []);

  if (!mounted || !active) return null;

  const isLast = step === STEPS.length - 1;
  const pad = 8;

  // tooltip position
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(360, vw - 24);
  let cardTop = vh / 2 - 90;
  let cardLeft = vw / 2 - cardW / 2;

  if (rect) {
    const below = rect.top + rect.height + 14;
    const spaceBelow = vh - (rect.top + rect.height);
    if (spaceBelow > 220) {
      cardTop = below;
    } else {
      cardTop = Math.max(12, rect.top - 210);
    }
    cardLeft = Math.min(
      Math.max(12, rect.left + rect.width / 2 - cardW / 2),
      vw - cardW - 12
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[1000]">
      {/* spotlight or full dim */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded border-2 border-red transition-all duration-300"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.74)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/74" />
      )}

      {/* click-catcher (advances on click outside card) */}
      <div className="absolute inset-0" onClick={() => !isLast && setStep((s) => s + 1)} />

      {/* tooltip card */}
      <div
        className="panel brackets absolute p-5 shadow-glow-lg"
        style={{ top: cardTop, left: cardLeft, width: cardW }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={finish}
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center text-muted hover:text-text"
          title="Close"
          aria-label="Close tutorial"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-red-bright" />
          <span className="mono text-[10px] uppercase tracking-[0.2em] text-red-bright">
            {STEPS[step].target ? `Step ${step} of ${STEPS.length - 2}` : "Guided Tour"}
          </span>
        </div>

        <h3 className="font-heading text-lg font-bold text-white">
          {STEPS[step].title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{STEPS[step].body}</p>

        {/* progress dots */}
        <div className="mt-4 flex items-center gap-1">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 ${i <= step ? "bg-red" : "bg-border-2"}`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            onClick={finish}
            className="mono text-[11px] uppercase tracking-wider text-muted-2 hover:text-text"
          >
            Skip tutorial
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="btn btn-ghost !px-3 !py-2 !text-[11px]"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            )}
            {isLast ? (
              <button onClick={finish} className="btn btn-primary !px-4 !py-2 !text-[11px]">
                <PlayCircle className="h-3.5 w-3.5" /> Go
              </button>
            ) : (
              <button
                onClick={() => setStep((s) => s + 1)}
                className="btn btn-primary !px-4 !py-2 !text-[11px]"
              >
                Next <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
