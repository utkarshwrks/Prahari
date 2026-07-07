"use client";

import { Download, FileText, Bell } from "lucide-react";
import { useIntel } from "@/store/intel";
import { clockString } from "@/lib/time";
import TacticalPanel from "../../ui/TacticalPanel";

const SEV_COLOR: Record<string, string> = {
  high: "text-red-bright",
  medium: "text-red-deep",
  low: "text-muted-2",
};

export default function AlertLog() {
  const alertLog = useIntel((s) => s.alertLog);
  const focusOnCity = useIntel((s) => s.focusOnCity);

  function exportJson() {
    const payload = {
      generated: new Date().toISOString(),
      jurisdiction: "Jabalpur",
      totalAlerts: alertLog.length,
      alerts: alertLog.map((a) => ({
        id: a.id,
        city: a.city,
        source: a.source,
        severity: a.severity,
        timestamp: new Date(a.timestamp).toISOString(),
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prahari-alert-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    const rows = alertLog
      .map(
        (a) =>
          `<tr><td>${clockString(new Date(a.timestamp))}</td><td>${a.city}</td><td>${a.source}</td><td>${a.severity.toUpperCase()}</td></tr>`
      )
      .join("");
    const html = `<!doctype html><html><head><title>PRAHARI Alert Report</title>
      <style>body{font-family:monospace;background:#0A0A0B;color:#F4F4F5;padding:32px}
      h1{color:#FF2A1F;letter-spacing:.1em}table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{border:1px solid #2A2A2E;padding:8px 12px;text-align:left;font-size:13px}
      th{color:#A1A1AA;text-transform:uppercase;letter-spacing:.1em}
      .meta{color:#A1A1AA;font-size:12px}</style></head>
      <body><h1>PRAHARI · GEOFENCE ALERT REPORT</h1>
      <div class="meta">MP Cyber Cell · Jabalpur Jurisdiction<br/>Generated ${new Date().toLocaleString()} · ${alertLog.length} alerts · SYNTHETIC DATA</div>
      <table><thead><tr><th>Time</th><th>City</th><th>Source</th><th>Severity</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">No alerts</td></tr>'}</tbody></table>
      <script>window.onload=()=>window.print()</script></body></html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }

  return (
    <TacticalPanel
      title="Alert Log"
      live
      right={
        <div className="flex items-center gap-1.5">
          <button
            onClick={exportJson}
            title="Export as JSON"
            className="flex items-center gap-1 border border-border px-1.5 py-0.5 text-[9px] text-muted transition hover:border-red/50 hover:text-red-bright"
          >
            <Download className="h-3 w-3" /> JSON
          </button>
          <button
            onClick={printReport}
            title="Printable report"
            className="flex items-center gap-1 border border-border px-1.5 py-0.5 text-[9px] text-muted transition hover:border-red/50 hover:text-red-bright"
          >
            <FileText className="h-3 w-3" /> REPORT
          </button>
        </div>
      }
    >
      <div className="slim-scroll max-h-[240px] space-y-1 overflow-y-auto p-3">
        {alertLog.length === 0 && (
          <div className="flex items-center gap-2 py-4 text-muted-2">
            <Bell className="h-3.5 w-3.5" />
            <span className="mono text-[10px] tracking-widest">NO ALERTS LOGGED</span>
          </div>
        )}
        {alertLog.map((a) => (
          <button
            key={a.id}
            onClick={() => focusOnCity(a.city)}
            title={`Locate ${a.city} on map`}
            className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-border/60 py-1.5 text-left transition hover:bg-panel-2/50"
          >
            <span className="mono text-[10px] tabular-nums text-muted-2">
              {clockString(new Date(a.timestamp))}
            </span>
            <span className="mono truncate text-[11px] text-text">{a.city}</span>
            <span className={`mono text-[9px] uppercase ${SEV_COLOR[a.severity]}`}>
              {a.source}
            </span>
          </button>
        ))}
      </div>
    </TacticalPanel>
  );
}
