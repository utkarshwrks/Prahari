"use client";

import { useMemo, useState } from "react";
import type { Timeline } from "@/lib/api";

/**
 * Per-persona activity over time — the PS's "queryable across a timeline".
 *
 * Deliberately NOT aggregated into one line. The shape that matters is one
 * persona going quiet while another appears, which is exactly what a rebrand
 * looks like; summing the series hides the only thing worth seeing.
 *
 * The brush selects a window, and the caption states plainly what the shape
 * means rather than leaving the analyst to infer it.
 */

const SERIES_COLORS = ["var(--c-high)", "#5B9BD5", "#D9A441", "#7FB77E", "#B57EDC"];

export default function ActorTimeline({ timeline }: { timeline: Timeline }) {
  const [range, setRange] = useState<[number, number]>([0, timeline.buckets.length - 1]);

  const max = useMemo(
    () => Math.max(1, ...timeline.series.flatMap((s) => s.counts)),
    [timeline]
  );

  const [lo, hi] = range;
  const visible = timeline.buckets.slice(lo, hi + 1);

  // Detect the rebrand shape: one series ends as another begins.
  const handoff = useMemo(() => {
    if (timeline.series.length < 2) return null;
    const lastActive = (c: number[]) => c.reduce((a, v, i) => (v > 0 ? i : a), -1);
    const firstActive = (c: number[]) => c.findIndex((v) => v > 0);
    for (const a of timeline.series) {
      for (const b of timeline.series) {
        if (a.persona_id === b.persona_id) continue;
        const end = lastActive(a.counts), start = firstActive(b.counts);
        if (end >= 0 && start > end) {
          return { from: a.handle, to: b.handle, gap: start - end };
        }
      }
    }
    return null;
  }, [timeline]);

  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h4 className="mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Activity timeline
        </h4>
        <span className="mono tnum text-[9px] text-[var(--muted-2)]">
          {visible[0]} → {visible[visible.length - 1]}
        </span>
      </div>

      <div className="border border-[var(--border)] bg-[var(--surface-2)] p-2.5">
        <div className="flex items-end gap-[3px]" style={{ height: 72 }}>
          {timeline.buckets.map((b, i) => {
            const inRange = i >= lo && i <= hi;
            return (
              <div
                key={b}
                title={`${b}: ${timeline.series.map((s) => `${s.handle} ${s.counts[i]}`).join(", ")}`}
                className="flex min-w-0 flex-1 flex-col-reverse gap-[1px]"
                style={{ opacity: inRange ? 1 : 0.22 }}
              >
                {timeline.series.map((s, si) => (
                  <div
                    key={s.persona_id}
                    style={{
                      height: `${(s.counts[i] / max) * 60}px`,
                      background: SERIES_COLORS[si % SERIES_COLORS.length],
                      minHeight: s.counts[i] > 0 ? 2 : 0,
                    }}
                  />
                ))}
              </div>
            );
          })}
        </div>

        {/* Window brush */}
        <div className="mt-2 flex items-center gap-2">
          <input
            type="range" min={0} max={timeline.buckets.length - 1} value={lo}
            aria-label="Timeline window start"
            onChange={(e) => setRange([Math.min(+e.target.value, hi), hi])}
            className="h-1 flex-1 accent-[var(--accent)]"
          />
          <input
            type="range" min={0} max={timeline.buckets.length - 1} value={hi}
            aria-label="Timeline window end"
            onChange={(e) => setRange([lo, Math.max(+e.target.value, lo)])}
            className="h-1 flex-1 accent-[var(--accent)]"
          />
        </div>

        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {timeline.series.map((s, si) => (
            <li key={s.persona_id} className="mono flex items-center gap-1.5 text-[9px] text-[var(--muted)]">
              <span
                className="inline-block h-2 w-2"
                style={{ background: SERIES_COLORS[si % SERIES_COLORS.length] }}
              />
              {s.handle}
            </li>
          ))}
        </ul>
      </div>

      {handoff && (
        <p className="mono mt-1.5 border-l-2 border-[var(--accent-dim)] pl-2 text-[9px] leading-relaxed text-[var(--muted)]">
          <span className="text-[var(--c-high)]">Rebrand shape:</span>{" "}
          {handoff.from} goes quiet, {handoff.to} begins {handoff.gap}{" "}
          {timeline.bucket}
          {handoff.gap === 1 ? "" : "s"} later. Timing alone is not evidence —
          it is why this pair was proposed for scoring.
        </p>
      )}
    </section>
  );
}
