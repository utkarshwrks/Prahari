"use client";

import { useEffect } from "react";
import { Download, FileText, X } from "lucide-react";
import type { ActorProfile } from "@/lib/api";
import { downloadActorReport } from "@/lib/reportPdf";

/**
 * A modal preview of the exact one-page PDF the analyst can download. Rendered
 * as a professional document (fixed light palette, not the app skin) so what
 * they see is what leaves the building. The Download button writes a real
 * vector PDF via lib/reportPdf.
 */

const dt = (s: string | null) => (s ? s.slice(0, 10) : "—");
const short = (v: string, n = 34) => (v.length > n ? `${v.slice(0, n - 8)}…${v.slice(-6)}` : v);
const confColor = (c: number | null | undefined) =>
  c == null ? "#6E7480" : c >= 0.75 ? "#E8503A" : c >= 0.4 ? "#C18A2B" : "#B0B5BE";

export default function ActorReportPreview({ profile, onClose }: { profile: ActorProfile; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const p = profile;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-[color-mix(in_srgb,var(--bg)_86%,black)]/95 backdrop-blur-md"
      onClick={onClose}>
      {/* toolbar */}
      <div className="flex shrink-0 items-center justify-between px-5 py-3" onClick={(e) => e.stopPropagation()}>
        <span className="mono flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
          <FileText className="h-3.5 w-3.5" /> Attribution report · one page
        </span>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadActorReport(p)}
            className="mono flex items-center gap-1.5 border border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--c-high)] transition hover:bg-[color-mix(in_srgb,var(--accent)_26%,transparent)]">
            <Download className="h-3.5 w-3.5" /> Download PDF
          </button>
          <button onClick={onClose} aria-label="Close preview"
            className="flex h-8 w-8 items-center justify-center border border-[var(--border-2)] text-[var(--muted)] transition hover:text-[var(--text)]">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* the page */}
      <div className="slim flex flex-1 items-start justify-center overflow-auto px-5 pb-6" onClick={(e) => e.stopPropagation()}>
        <div className="w-full max-w-[980px] shrink-0 overflow-hidden rounded-[3px] bg-white text-[#12141A] shadow-2xl"
          style={{ aspectRatio: "297 / 210", containerType: "inline-size" }}>
          <Report p={p} />
        </div>
      </div>
    </div>
  );
}

function Report({ p }: { p: ActorProfile }) {
  const conf = p.attribution_confidence;
  return (
    <div className="flex h-full flex-col" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      {/* header band */}
      <div className="relative flex items-center justify-between bg-[#12141A] px-[3%] py-[2%] text-white">
        <div>
          <p className="text-[1.7cqw] font-bold tracking-wide">PRAHARI</p>
          <p className="text-[0.85cqw] tracking-[0.2em] text-[#BEC1C8]">THREAT ACTOR ATTRIBUTION REPORT</p>
        </div>
        <div className="text-right text-[0.8cqw] leading-relaxed text-[#BEC1C8]">
          <p>Case ref&nbsp;&nbsp;{p.actor_id.toUpperCase()}</p>
          <p>{new Date().toISOString().replace("T", " ").slice(0, 16)} UTC</p>
          <p className="text-[#E8503A]">CONFIDENTIAL · calibrated attribution</p>
        </div>
        <span className="absolute inset-x-0 bottom-0 h-[3px] bg-[#E8503A]" />
      </div>

      <div className="grid flex-1 grid-cols-[1.15fr_1fr] gap-[3%] px-[3%] py-[2.5%]">
        {/* left */}
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-[2.6cqw] font-bold leading-none">{p.label}</h1>
              <p className="mt-[0.6cqw] text-[0.95cqw] text-[#6E7480]">
                {p.actor_id} · {p.personas.length} personas · {p.post_count} posts
              </p>
            </div>
            <div className="shrink-0 rounded border border-[#DFE2E7] px-[1.4cqw] py-[1cqw] text-right">
              <p className="text-[0.72cqw] tracking-wide text-[#6E7480]">ATTRIBUTION CONFIDENCE</p>
              <p className="text-[2.6cqw] font-bold leading-tight" style={{ color: confColor(conf) }}>
                {conf == null ? "—" : conf.toFixed(3)}
              </p>
              <span className="block h-[0.5cqw] w-full rounded bg-[#F0F1F4]">
                <span className="block h-full rounded" style={{ width: `${(conf ?? 0) * 100}%`, background: confColor(conf) }} />
              </span>
            </div>
          </div>

          <p className="mt-[1.4cqw] text-[0.92cqw] leading-relaxed text-[#33363E]">{p.confidence_basis}</p>

          {p.flags.length > 0 && (
            <div className="mt-[1.2cqw] rounded border border-[#E8503A] bg-[#FDEDEA] px-[1.4cqw] py-[1cqw]">
              <p className="text-[0.75cqw] font-bold tracking-wide text-[#E8503A]">COUNTER-DECEPTION FLAGS</p>
              <p className="text-[0.85cqw] text-[#33363E]">{p.flags.join("  ·  ")}</p>
            </div>
          )}

          <Section title="Personas" />
          {p.personas.slice(0, 6).map((s) => (
            <div key={s.id} className="flex items-baseline justify-between border-b border-[#EEF0F3] py-[0.5cqw]">
              <span className="truncate text-[0.95cqw]">
                <b>{s.handle}</b> <span className="text-[#6E7480]">@{s.market}</span>
                <span className="ml-2 text-[0.78cqw] text-[#AEB3BC]">{dt(s.first_seen)} → {dt(s.last_seen)}</span>
              </span>
              <span className="shrink-0 text-[0.82cqw] text-[#6E7480]">{s.post_count} posts</span>
            </div>
          ))}

          <Section title="Persona linkages" />
          {p.linkages.length === 0 && <p className="text-[0.85cqw] text-[#AEB3BC]">Single persona — nothing to link.</p>}
          {p.linkages.slice(0, 5).map((l) => (
            <div key={`${l.persona_a}|${l.persona_b}`} className="flex items-baseline justify-between py-[0.35cqw] text-[0.88cqw]">
              <span className="truncate">{l.persona_a} ↔ {l.persona_b}</span>
              <span className="shrink-0 font-bold" style={{ color: l.confidence >= 0.75 ? "#E8503A" : "#6E7480" }}>{l.confidence.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* right */}
        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-[2%]">
            {[["MARKETS", p.markets.join(", ") || "—"], ["ACTIVE", `${dt(p.first_seen)} → ${dt(p.last_seen)}`],
              ["CATEGORIES", p.categories.join(", ") || "—"], ["LAST SCAN", (p.last_scan ?? "—").replace("T", " ").slice(0, 16)]].map(([k, v]) => (
              <div key={k} className="rounded bg-[#F4F5F8] px-[1.2cqw] py-[0.9cqw]">
                <p className="text-[0.68cqw] tracking-wide text-[#6E7480]">{k}</p>
                <p className="mt-[0.3cqw] truncate text-[0.85cqw] font-semibold">{v}</p>
              </div>
            ))}
          </div>

          <Section title="Identifiers" />
          {p.identifiers.length === 0 && <p className="text-[0.85cqw] text-[#AEB3BC]">None recovered — held together by style and timing.</p>}
          {p.identifiers.slice(0, 8).map((i) => (
            <div key={`${i.kind}-${i.value}`} className="flex items-baseline gap-2 py-[0.4cqw] text-[0.85cqw]">
              <span className="w-[7cqw] shrink-0 font-bold tracking-wide" style={{ color: i.shared ? "#E8503A" : "#6E7480", fontSize: "0.68cqw" }}>
                {i.kind.toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate">{short(i.value)}</span>
              {i.shared && <span className="shrink-0 text-[0.7cqw] font-semibold text-[#E8503A]">shared ×{i.personas.length}</span>}
            </div>
          ))}

          <Section title="Infrastructure indicators" />
          {p.infrastructure.length === 0 && <p className="text-[0.85cqw] text-[#AEB3BC]">No clearnet pivot recovered.</p>}
          {p.infrastructure.slice(0, 4).map((x) => (
            <div key={x.clearnet_host} className="py-[0.4cqw]">
              <div className="flex items-baseline justify-between text-[0.9cqw]">
                <b>{x.clearnet_host}</b>
                <span className="font-bold text-[#E8503A]">{x.strength.toFixed(2)}</span>
              </div>
              <p className="truncate text-[0.72cqw] text-[#AEB3BC]">{x.evidence[0]?.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[#DFE2E7] px-[3%] py-[1.4%] text-[0.72cqw] text-[#6E7480]">
        <span>Sources: {p.sources.join(", ") || "—"} · reproducible with python -m engine.fusion.eval</span>
        <span>Attribution is correlation of public footprints, not surveillance.</span>
      </div>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return (
    <p className="mt-[1.6cqw] border-t border-[#DFE2E7] pt-[0.8cqw] text-[0.78cqw] font-bold uppercase tracking-[0.14em] text-[#E8503A]">
      {title}
    </p>
  );
}
