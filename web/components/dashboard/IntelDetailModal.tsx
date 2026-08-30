"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { trapFocus } from "@/lib/a11y";
import { toast } from "sonner";
import { X, MapPin, FolderPlus, Radar, Flag, Bitcoin, AtSign, Clock as ClockIcon, ExternalLink, Radio, Check, AlertTriangle } from "lucide-react";
import { Intercept } from "@/lib/mockIntel";
import { useIntel } from "@/store/intel";
import { useRecords } from "@/store/records";
import { categoryOf } from "@/lib/mockIntel";
import { isInJabalpurZone } from "@/lib/cities";
import { clockString } from "@/lib/time";

export default function IntelDetailModal({
  intercept,
  onClose,
}: {
  intercept: Intercept;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const registerCities = useIntel((s) => s.registerCities);
  const focusOnCity = useIntel((s) => s.focusOnCity);
  const addRecord = useRecords((s) => s.addRecord);

  if (!mounted) return null;

  const e = intercept.entities;
  const inZone = e.locations.some((c) => isInJabalpurZone(c));

  function locate() {
    if (e.locations.length) {
      registerCities(e.locations, "analysis");
      focusOnCity(e.locations[0]); // fly the map to the location
    }
    onClose();
  }
  function createCase() {
    const id = addRecord({
      title: `${e.contraband[0] ?? "Intercept"} — ${e.locations[0] ?? "unknown"}`,
      city: e.locations[0] ?? "",
      category: categoryOf(e.contraband[0] ?? "") ?? "Other",
      severity: intercept.severity,
      status: "Open",
      wallet: e.wallets[0],
      handle: e.handles[0],
      sourceText: intercept.rawText,
    });
    toast.custom(() => (
      <div className="mono flex items-center gap-1.5 border border-red bg-panel px-3 py-2 text-[12px] text-text shadow-glow">
        <Check className="h-3 w-3 shrink-0 text-red-bright" />
        Case <span className="text-red-bright">{id}</span> created
      </div>
    ));
    onClose();
  }

  // Focus trap + Escape. v1 let Tab walk out of the open modal into the page
  // behind it, and never announced the dialog to a screen reader.
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!dialogRef.current) return;
    return trapFocus(dialogRef.current, onClose);
  }, [onClose]);

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Intercept detail"
      className="fixed inset-0 z-[950] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="panel brackets relative w-full max-w-md p-5">
        <button onClick={onClose} aria-label="Close intercept detail"
          className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center text-muted hover:text-text">
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <span className="mono text-[10px] uppercase tracking-[0.18em] text-red-bright">Intercept Detail</span>
          {intercept.live && intercept.channel && (
            <span className="mono flex items-center gap-1 border border-red/40 bg-red/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-red-bright">
              <Radio className="h-2.5 w-2.5" /> Live · {intercept.channel}
            </span>
          )}
        </div>
        <div className="mono mt-1 text-sm font-bold text-text">{intercept.id}</div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Meta icon={Radar} label="Source" value={intercept.source} />
          <Meta icon={Flag} label="Severity" value={intercept.severity} />
          <Meta icon={ClockIcon} label="Time" value={clockString(new Date(intercept.timestamp))} />
        </div>

        <div className="label mt-4 mb-1.5">Raw Listing</div>
        <div className="border-l-2 border-red/60 bg-panel-2/50 p-3 text-[12.5px] leading-relaxed text-text/90">
          {intercept.rawText}
        </div>

        <div className="label mt-4 mb-1.5">Extracted Entities</div>
        <div className="flex flex-wrap gap-1.5">
          {e.locations.map((l) => <Chip key={l} icon={<MapPin className="h-3 w-3" />} cls="border-red/50 bg-red/10 text-red-bright">{l}</Chip>)}
          {e.contraband.map((c) => <Chip key={c} icon={<Flag className="h-3 w-3" />} cls="border-border-2 bg-panel-2 text-text">{c}</Chip>)}
          {e.wallets.map((w) => <Chip key={w} icon={<Bitcoin className="h-3 w-3" />} cls="border-border-2 bg-panel-2 text-muted">{w.slice(0, 8)}…</Chip>)}
          {e.handles.map((h) => <Chip key={h} icon={<AtSign className="h-3 w-3" />} cls="border-white/20 bg-white/5 text-text">{h.replace(/^@/, "")}</Chip>)}
        </div>

        {inZone && (
          <div className="mono mt-3 flex items-center gap-1.5 border border-red/40 bg-red/10 px-2 py-1.5 text-[10px] uppercase tracking-widest text-red-bright">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            In-zone jurisdiction hit
          </div>
        )}

        {intercept.live && intercept.url && (
          <a
            href={intercept.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost mt-4 w-full !py-2 !text-[11px]"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open Source Article
          </a>
        )}

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button onClick={locate} disabled={!e.locations.length} className="btn btn-ghost !py-2 !text-[11px] disabled:opacity-40">
            <MapPin className="h-3.5 w-3.5" /> Locate on Map
          </button>
          <button onClick={createCase} className="btn btn-primary !py-2 !text-[11px]">
            <FolderPlus className="h-3.5 w-3.5" /> Create Case
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Meta({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="border border-border bg-panel-2/40 px-2 py-1.5">
      <div className="mono flex items-center gap-1 text-[8px] uppercase tracking-wider text-muted-2">
        <Icon className="h-2.5 w-2.5" /> {label}
      </div>
      <div className="mono mt-0.5 truncate text-[11px] uppercase text-text">{value}</div>
    </div>
  );
}

function Chip({ icon, children, cls }: { icon: React.ReactNode; children: React.ReactNode; cls: string }) {
  return (
    <span className={`mono inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] ${cls}`}>
      {icon}{children}
    </span>
  );
}
