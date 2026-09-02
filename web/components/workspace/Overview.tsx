"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Database, Gauge, Layers, ScrollText, ShieldCheck } from "lucide-react";
import { api, type ActorList, type EvalMetrics, type SourcesResult } from "@/lib/api";
import { ACTOR_PAGE } from "./ActorsTable";
import { BAND_LABEL, BAND_THRESHOLD, bandOf, type Band } from "@/lib/workspace";
import { relativeTime } from "@/lib/time";

/**
 * The triage Overview (DEC-056).
 *
 * Every number on this page comes from the engine. Where the engine cannot
 * answer -- Neo4j down on a free-tier deploy, a source with no key -- the tile
 * says so in words and renders nothing else. It does NOT draw a zero, because a
 * zero is a measurement and "we could not ask" is not (INV-5, INV-9).
 *
 * There are no invented widgets here. Each block maps to one endpoint:
 * /actors, /fusion/metrics, /sources, /graph/stats, /audit/cases.
 */

interface GraphStats {
  ok: boolean; personas: number; entities: number; edges: number;
  actors: number; communities: number; embedded: number;
  available?: boolean; detail?: string;
}
interface CaseList { ok: boolean; cases: string[]; actions: string[]; detail?: string }

/** A metric with its definition, so no number on screen is unexplained. */
const METRIC_HELP: Record<string, string> = {
  precision: "Of the pairs the model merged, the share that were genuinely the same actor.",
  recall: "Of the pairs that were genuinely the same actor, the share the model merged.",
  f1: "Harmonic mean of precision and recall.",
  "false-merge": "Measured rate of merging two different actors, at the operating threshold τ.",
  brier: "Mean squared error of the probabilities. Lower is better calibrated.",
  ece: "Expected calibration error: how far stated confidence sits from observed frequency.",
};

function Tile({
  label, value, hint, unavailable,
}: { label: string; value: string; hint?: string; unavailable?: string }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--surface-2)] p-2.5">
      <p className="mono text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">{label}</p>
      {unavailable ? (
        <p className="mono mt-1 text-[10px] leading-snug text-[var(--muted-2)]">{unavailable}</p>
      ) : (
        <p className="mono tnum mt-1 text-lg font-bold text-[var(--text)]">{value}</p>
      )}
      {hint && !unavailable && (
        <p className="mono mt-0.5 text-[8.5px] leading-snug text-[var(--muted-2)]">{hint}</p>
      )}
    </div>
  );
}

function Section({
  title, icon: Icon, children, right,
}: { title: string; icon: typeof Gauge; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="glass p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="mono flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
          <Icon className="h-3 w-3" /> {title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function Overview() {
  const [actors, setActors] = useState<ActorList | null>(null);
  const [metrics, setMetrics] = useState<EvalMetrics | null>(null);
  const [sources, setSources] = useState<SourcesResult | null>(null);
  const [graph, setGraph] = useState<GraphStats | null>(null);
  const [cases, setCases] = useState<CaseList | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      // The engine's page ceiling, so the band counts cover as much of the
      // index as one call can. The caption below states when that is not all.
      const [a, m, s] = await Promise.all([
        api.actors("", 0, ACTOR_PAGE),
        api.metrics(),
        api.sources(),
      ]);
      if (!alive) return;
      if ("ok" in a && a.ok) setActors(a as ActorList);
      if ("ok" in m && m.ok) setMetrics(m as EvalMetrics);
      if ("ok" in s && s.ok) setSources(s as SourcesResult);

      const [g, c] = await Promise.all([
        fetch("/api/engine/graph/stats", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/engine/audit/cases", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      ]);
      if (!alive) return;
      setGraph(g);
      setCases(c);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const rows = actors?.actors ?? [];
  const bands: Record<Band, number> = { strong: 0, "worth-a-look": 0, weak: 0 };
  for (const r of rows) bands[bandOf(r.attribution_confidence)] += 1;

  return (
    <div className="space-y-3">
      {/* ---- triage ---------------------------------------------------- */}
      <Section
        title="Triage"
        icon={Layers}
        right={
          <span className="mono text-[9px] text-[var(--muted-2)]">
            {actors ? `${actors.total} actors` : loading ? "loading" : "engine offline"}
          </span>
        }
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(["strong", "worth-a-look", "weak"] as Band[]).map((b) => (
            <Link
              key={b}
              href={`/workbench/actors?band=${b}`}
              className="border border-[var(--border)] bg-[var(--surface-2)] p-2.5 transition hover:border-[var(--accent-dim)]"
            >
              <p className="mono text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
                {BAND_LABEL[b]}
              </p>
              <p className="mono tnum mt-1 text-2xl font-bold text-[var(--c-high)]">
                {actors ? bands[b] : "—"}
              </p>
              <p className="mono mt-0.5 text-[8.5px] text-[var(--muted-2)]">
                attribution confidence {BAND_THRESHOLD[b]}
              </p>
            </Link>
          ))}
        </div>
      </Section>

      {/* ---- model health --------------------------------------------- */}
      <Section title="Model health" icon={Gauge}>
        {metrics ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            <Tile label="Precision" value={metrics.precision.toFixed(3)} hint={METRIC_HELP.precision} />
            <Tile label="Recall" value={metrics.recall.toFixed(3)} hint={METRIC_HELP.recall} />
            <Tile label="F1" value={metrics.f1.toFixed(3)} hint={METRIC_HELP.f1} />
            <Tile
              label={`FMR @ α=${metrics.alpha}`}
              value={`${(metrics.false_merge_rate * 100).toFixed(1)}%`}
              hint={METRIC_HELP["false-merge"]}
            />
            <Tile label="Brier" value={metrics.brier.toFixed(4)} hint={METRIC_HELP.brier} />
            <Tile label="ECE" value={metrics.ece.toFixed(4)} hint={METRIC_HELP.ece} />
          </div>
        ) : (
          <p className="mono text-[10px] text-[var(--muted-2)]">
            {loading ? "Loading metrics…" : "Metrics not available — the engine did not answer."}
          </p>
        )}
        {metrics && (
          <p className="mono mt-2 text-[9px] leading-relaxed text-[var(--muted-2)]">
            Measured over {metrics.n_pairs} validation pairs at τ={metrics.tau.toFixed(3)}. The α=0.05
            guarantee {metrics.guarantee_holds ? "holds" : "does NOT hold"} on this set. Regeneration
            steps are in docs/METRICS.md.
          </p>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {/* ---- sources ------------------------------------------------ */}
        <Section title="Source inventory" icon={Database}>
          {sources ? (
            <ul className="space-y-1">
              {sources.sources.map((s) => (
                <li
                  key={s.name}
                  className="mono flex items-center justify-between gap-2 border-b border-[var(--border)] py-1 text-[10px] last:border-0"
                >
                  <span className="truncate text-[var(--text)]">{s.name}</span>
                  <span className="flex shrink-0 items-center gap-2 text-[9px] text-[var(--muted-2)]">
                    <span>{s.kind}</span>
                    {/* Never render a key value — only whether one is present. */}
                    <span>{s.requires_key ? (s.key_present ? "key present" : "no key") : "keyless"}</span>
                    <span className="tnum">
                      {s.freshness_s === null ? "never scanned" : relativeTime(Date.now() - s.freshness_s * 1000)}
                    </span>
                    <span className="tnum">{s.items_24h} / 24h</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mono text-[10px] text-[var(--muted-2)]">
              {loading ? "Loading sources…" : "Source inventory not available."}
            </p>
          )}
          {sources && (
            <p className="mono mt-2 text-[9px] text-[var(--muted-2)]">
              Scheduler {sources.scheduler.running ? "running" : "stopped"} ·{" "}
              {sources.scheduler.jobs.length} jobs · database{" "}
              {sources.database ? "connected" : "unavailable"}
            </p>
          )}
        </Section>

        {/* ---- graph stats -------------------------------------------- */}
        <Section title="Identity graph" icon={Layers}>
          {graph?.ok ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Tile label="Actors" value={String(graph.actors)} />
              <Tile label="Personas" value={String(graph.personas)} />
              <Tile label="Entities" value={String(graph.entities)} />
              <Tile label="Edges" value={String(graph.edges)} />
              <Tile label="Communities" value={String(graph.communities)} />
              <Tile label="Embedded" value={String(graph.embedded)} />
            </div>
          ) : (
            // The honest degradation: name what is down and what it costs,
            // rather than drawing six zeroes that read as measurements.
            <div className="border border-[var(--border)] bg-[var(--surface-2)] p-2.5">
              <p className="mono text-[10px] text-[var(--text)]">Not available</p>
              <p className="mono mt-1 text-[9px] leading-relaxed text-[var(--muted-2)]">
                {graph?.detail ?? "The engine did not answer."} Actor profiles, the evidence trail and
                the ledger are unaffected — they are served from the relational store. Graph search and
                community detection are the features that need it.
              </p>
            </div>
          )}
        </Section>
      </div>

      {/* ---- cases ----------------------------------------------------- */}
      <Section title="Case ledger" icon={ShieldCheck}>
        {cases?.ok && cases.cases.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {cases.cases.map((c) => (
              <li key={c}>
                <Link
                  href={`/workbench/case/${c}`}
                  className="mono flex items-center gap-1.5 border border-[var(--border-2)] px-2 py-1 text-[10px] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)]"
                >
                  <ScrollText className="h-3 w-3" />
                  {c}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mono text-[10px] text-[var(--muted-2)]">
            {loading ? "Loading cases…" : "No cases recorded yet."}
          </p>
        )}
        <p className="mono mt-2 text-[9px] leading-relaxed text-[var(--muted-2)]">
          Seal status, the Merkle root and inclusion proofs live on each case page. An anchor link
          appears only when a seal reached a public chain — a local seal is not a public one, and
          showing a link for it would invite the wrong conclusion.
        </p>
      </Section>
    </div>
  );
}
