"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  X,
  ChevronLeft,
  MapPin,
  Crosshair,
  Ruler,
  Clock as ClockIcon,
  UserCheck,
  CheckCheck,
  Check,
  Radar,
  FolderPlus,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { trapFocus } from "@/lib/a11y";
import { useIntel, AlertStatus, AlertLogEntry } from "@/store/intel";
import { useRecords } from "@/store/records";
import { clockString, relativeTime } from "@/lib/time";

const OFFICERS = [
  "Insp. R. Verma",
  "SI A. Yadav",
  "SI P. Nema",
  "HC S. Ali",
  "Unassigned",
];

const STATUSES: AlertStatus[] = ["New", "Acknowledged", "Investigating", "Closed"];

const STATUS_STYLE: Record<AlertStatus, string> = {
  New: "border-red/50 text-red-bright",
  Acknowledged: "border-border-2 text-muted",
  Investigating: "border-red-deep/60 text-red-deep",
  Closed: "border-border-2 text-muted-2",
};

const SEV_STYLE: Record<string, string> = {
  high: "text-red-bright",
  medium: "text-red-deep",
  low: "text-muted-2",
};

export default function NotificationCenter() {
  const alertLog = useIntel((s) => s.alertLog);
  const markAllRead = useIntel((s) => s.markAllAlertsRead);
  const focusOnCity = useIntel((s) => s.focusOnCity);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sevFilter, setSevFilter] = useState<"all" | "high" | "medium">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AlertStatus>("all");
  const [mounted, setMounted] = useState(false);
  // Focus trap + Escape for the drawer (Phase 1 audit: v1 had neither).
  const drawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !drawerRef.current) return;
    return trapFocus(drawerRef.current, () => setOpen(false));
  }, [open]);

  useEffect(() => setMounted(true), []);

  const unread = alertLog.filter((a) => !a.read).length;

  const filtered = useMemo(
    () =>
      alertLog.filter(
        (a) =>
          (sevFilter === "all" || a.severity === sevFilter) &&
          (statusFilter === "all" || a.status === statusFilter)
      ),
    [alertLog, sevFilter, statusFilter]
  );

  const selected = alertLog.find((a) => a.id === selectedId) ?? null;

  function openCenter() {
    setOpen(true);
  }
  function closeCenter() {
    setOpen(false);
    setSelectedId(null);
  }

  return (
    <>
      {/* Bell */}
      <button
        data-tour="bell"
        onClick={openCenter}
        title="Alert notifications"
        className="relative flex h-8 w-8 items-center justify-center border border-border bg-panel-2 text-muted transition hover:border-red/50 hover:text-red-bright"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red px-1 text-[9px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Drawer — portalled to body so the header's backdrop-blur can't trap
          its position:fixed inside the header box. */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeCenter}
              className="fixed inset-0 z-[900] bg-black/60 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Alert notifications"
              className="fixed right-0 top-0 z-[901] flex h-full w-full max-w-[420px] flex-col border-l border-border bg-panel shadow-glow-lg"
            >
              {/* header */}
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  {selected && (
                    <button
                      onClick={() => setSelectedId(null)}
                      className="flex h-6 w-6 items-center justify-center border border-border text-muted hover:text-text"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <Bell className="h-4 w-4 text-red-bright" />
                  <span className="mono text-xs font-semibold uppercase tracking-[0.18em] text-text">
                    {selected ? "Alert Detail" : "Alert Center"}
                  </span>
                  {!selected && (
                    <span className="mono text-[10px] text-muted-2">
                      {filtered.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={closeCenter}
                  className="flex h-7 w-7 items-center justify-center border border-border text-muted hover:text-text"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {selected ? (
                <AlertDetail alert={selected} onLocate={closeCenter} />
              ) : (
                <>
                  {/* toolbar */}
                  <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2">
                    <Filter label="All" active={sevFilter === "all"} onClick={() => setSevFilter("all")} />
                    <Filter label="High" active={sevFilter === "high"} onClick={() => setSevFilter("high")} />
                    <Filter label="Med" active={sevFilter === "medium"} onClick={() => setSevFilter("medium")} />
                    <span className="mx-0.5 h-4 w-px bg-border-2" />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as AlertStatus | "all")}
                      className="mono border border-border bg-panel-2 px-1.5 py-1 text-[10px] uppercase tracking-wider text-muted outline-none"
                    >
                      <option value="all">All status</option>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={markAllRead}
                      className="mono ml-auto flex items-center gap-1 border border-border px-1.5 py-1 text-[10px] uppercase tracking-wider text-muted transition hover:border-red/50 hover:text-red-bright"
                    >
                      <CheckCheck className="h-3 w-3" /> Read all
                    </button>
                  </div>

                  {/* list */}
                  <div className="slim-scroll flex-1 overflow-y-auto">
                    {filtered.length === 0 && (
                      <div className="flex h-full items-center justify-center">
                        <span className="mono text-[11px] tracking-widest text-muted-2">
                          NO ALERTS
                        </span>
                      </div>
                    )}
                    {filtered.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => { setSelectedId(a.id); focusOnCity(a.city); }}
                        className="flex w-full items-start gap-2.5 border-b border-border/60 px-3 py-2.5 text-left transition hover:bg-panel-2/60"
                      >
                        <span
                          className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${a.read ? "bg-transparent" : "bg-red-bright"}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="mono flex items-center gap-1 text-[12px] font-semibold text-text">
                              <MapPin className="h-3 w-3 text-red-bright" />
                              {a.city}
                            </span>
                            <span className="mono text-[9px] text-muted-2">
                              {relativeTime(a.timestamp)}
                            </span>
                          </div>
                          <div className="mono mt-0.5 truncate text-[10px] text-muted">
                            {a.rawText}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className={`mono text-[9px] uppercase ${SEV_STYLE[a.severity]}`}>
                              {a.severity}
                            </span>
                            <span className="text-muted-2">·</span>
                            <span className={`mono border px-1 text-[9px] uppercase ${STATUS_STYLE[a.status]}`}>
                              {a.status}
                            </span>
                            <span className="mono ml-auto text-[9px] text-muted-2">
                              {a.source}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </motion.aside>
          </>
        )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

function Filter({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`mono border px-2 py-1 text-[10px] uppercase tracking-wider transition ${
        active ? "border-red bg-red/10 text-red-bright" : "border-border text-muted hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}

function AlertDetail({ alert, onLocate }: { alert: AlertLogEntry; onLocate: () => void }) {
  const setAlertStatus = useIntel((s) => s.setAlertStatus);
  const assignAlert = useIntel((s) => s.assignAlert);
  const noteAlert = useIntel((s) => s.noteAlert);
  const registerCities = useIntel((s) => s.registerCities);
  const focusOnCity = useIntel((s) => s.focusOnCity);
  const addRecord = useRecords((s) => s.addRecord);
  const [note, setNote] = useState(alert.note ?? "");

  function createRecord() {
    const id = addRecord({
      title: `Geofence breach — ${alert.city}`,
      city: alert.city,
      category: "Other",
      severity: alert.severity,
      status: "Open",
      assignee: alert.assignee ?? "Unassigned",
      notes: alert.note ?? "",
      sourceText: alert.rawText,
    });
    toast.custom(() => (
      <div className="mono flex items-center gap-1.5 border border-red bg-panel px-3 py-2 text-[12px] text-text shadow-glow">
        <Check className="h-3 w-3 shrink-0 text-red-bright" />
        Case record <span className="text-red-bright">{id}</span> created
      </div>
    ));
  }

  return (
    <div className="slim-scroll flex-1 overflow-y-auto p-4">
      {/* headline */}
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center border border-red bg-red/10">
          <Crosshair className="h-4 w-4 text-red-bright" />
        </span>
        <div>
          <div className="mono text-lg font-bold text-text">{alert.city}</div>
          <div className="mono text-[10px] uppercase tracking-widest text-red-bright">
            In-Zone Geofence Breach
          </div>
        </div>
      </div>

      {/* meta grid */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Meta icon={ClockIcon} label="Time" value={clockString(new Date(alert.timestamp))} />
        <Meta icon={Ruler} label="From Jabalpur" value={`${alert.distanceKm} km`} />
        <Meta icon={Radar} label="Source" value={alert.source} />
        <Meta icon={MapPin} label="Coords" value={`${alert.lat.toFixed(2)}, ${alert.lng.toFixed(2)}`} />
      </div>

      {/* severity */}
      <div className="mt-2">
        <span className={`mono text-[10px] uppercase tracking-widest ${SEV_STYLE[alert.severity]}`}>
          Severity · {alert.severity}
        </span>
      </div>

      {/* raw text */}
      <div className="mt-4">
        <div className="label mb-1.5 flex items-center gap-1.5">
          Intercept
          {alert.live && alert.channel && (
            <span className="mono border border-red/40 bg-red/10 px-1 text-[8px] uppercase tracking-wider text-red-bright">
              Live · {alert.channel}
            </span>
          )}
        </div>
        <div className="border-l-2 border-red/60 bg-panel-2/50 p-3 text-[12px] leading-relaxed text-text/90">
          {alert.rawText}
        </div>
        {alert.live && alert.url && (
          <a
            href={alert.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost mt-2 w-full !py-1.5 !text-[10px]"
          >
            <ExternalLink className="h-3 w-3" /> Open Exact Source
          </a>
        )}
      </div>

      {/* status controls */}
      <div className="mt-4">
        <div className="label mb-1.5">Status</div>
        <div className="grid grid-cols-2 gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setAlertStatus(alert.id, s)}
              className={`mono border px-2 py-1.5 text-[10px] uppercase tracking-wider transition ${
                alert.status === s
                  ? "border-red bg-red/10 text-red-bright"
                  : "border-border text-muted hover:text-text"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* assign */}
      <div className="mt-4">
        <div className="label mb-1.5 flex items-center gap-1">
          <UserCheck className="h-3 w-3" /> Assign Officer
        </div>
        <select
          value={alert.assignee ?? "Unassigned"}
          onChange={(e) => assignAlert(alert.id, e.target.value)}
          className="field mono text-[12px]"
        >
          {OFFICERS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {/* note */}
      <div className="mt-4">
        <div className="label mb-1.5">Case Note</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => noteAlert(alert.id, note)}
          rows={3}
          placeholder="Add an investigation note…"
          className="field mono slim-scroll resize-none text-[12px]"
        />
        {alert.note && (
          <div className="mono mt-1 text-[9px] text-muted-2">Saved.</div>
        )}
      </div>

      {/* actions */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            registerCities([alert.city], "analysis");
            focusOnCity(alert.city);
            onLocate(); // close the drawer so the map (flying to the city) is visible
          }}
          className="btn btn-ghost !py-2 !text-[11px]"
        >
          <MapPin className="h-3.5 w-3.5" /> Locate on Map
        </button>
        <button onClick={createRecord} className="btn btn-primary !py-2 !text-[11px]">
          <FolderPlus className="h-3.5 w-3.5" /> Create Case
        </button>
      </div>
    </div>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ClockIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-border bg-panel-2/40 px-2.5 py-2">
      <div className="mono flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-2">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mono mt-0.5 truncate text-[12px] text-text">{value}</div>
    </div>
  );
}
