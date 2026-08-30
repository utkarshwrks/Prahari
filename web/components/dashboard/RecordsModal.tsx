"use client";

import { useMemo, useState } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  AreaChart, Area, Tooltip as RTooltip,
} from "recharts";
import {
  X, Plus, Pencil, Trash2, Search, Download, FileText, FolderKanban,
  BarChart3, Save, ArrowLeft,
} from "lucide-react";
import {
  useRecords, CaseRecord, CaseStatus, CaseSeverity,
  CASE_STATUSES, CASE_CATEGORIES, CASE_OFFICERS,
} from "@/store/records";
import { useIntel } from "@/store/intel";
import { CITIES } from "@/lib/cities";
import { activityBuckets } from "@/lib/analytics";
import { clockString } from "@/lib/time";

type Tab = "records" | "analytics" | "reports";

const SEV_COLOR: Record<CaseSeverity, string> = { high: "#FF3B30", medium: "#C11030", low: "#71717A" };
const STATUS_COLOR: Record<CaseStatus, string> = {
  Open: "#FF3B30", "In Progress": "#E10600", Escalated: "#C11030", Closed: "#71717A",
};

export default function RecordsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("records");

  return (
    <div className="fixed inset-0 z-[950] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="panel brackets relative flex h-full max-h-[92vh] w-full max-w-[1200px] flex-col">
        {/* header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-red-bright" />
            <span className="mono text-sm font-semibold uppercase tracking-[0.16em] text-text">
              Records & Reports
            </span>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center border border-border text-muted hover:text-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* tabs */}
        <div className="flex gap-1 border-b border-border px-3 py-2">
          {([["records", "Records", FolderKanban], ["analytics", "Analytics", BarChart3], ["reports", "Reports", FileText]] as const).map(
            ([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`mono flex items-center gap-1.5 border px-3 py-1.5 text-[11px] uppercase tracking-wider transition ${
                  tab === id ? "border-red bg-red/10 text-red-bright" : "border-border text-muted hover:text-text"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            )
          )}
        </div>

        <div className="slim-scroll min-h-0 flex-1 overflow-y-auto">
          {tab === "records" && <RecordsTab />}
          {tab === "analytics" && <AnalyticsTab />}
          {tab === "reports" && <ReportsTab />}
        </div>
      </div>
    </div>
  );
}

// ---------------- RECORDS (CRUD) ----------------
function RecordsTab() {
  const records = useRecords((s) => s.records);
  const deleteRecord = useRecords((s) => s.deleteRecord);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CaseStatus>("all");
  const [editing, setEditing] = useState<CaseRecord | "new" | null>(null);

  const filtered = useMemo(
    () =>
      records.filter((r) => {
        const q = search.toLowerCase();
        const match = !q || `${r.title} ${r.city} ${r.assignee} ${r.handle ?? ""} ${r.wallet ?? ""} ${r.id}`.toLowerCase().includes(q);
        return match && (statusFilter === "all" || r.status === statusFilter);
      }),
    [records, search, statusFilter]
  );

  if (editing) {
    return <RecordEditor record={editing === "new" ? null : editing} onDone={() => setEditing(null)} />;
  }

  return (
    <div className="p-4">
      {/* toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 border border-border bg-panel-2 px-2">
          <Search className="h-3.5 w-3.5 text-muted-2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search records…"
            className="mono bg-transparent py-1.5 text-[12px] text-text outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CaseStatus | "all")}
          className="mono border border-border bg-panel-2 px-2 py-1.5 text-[11px] uppercase tracking-wider text-muted outline-none"
        >
          <option value="all">All status</option>
          {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="mono text-[10px] text-muted-2">{filtered.length} records</span>
        <button onClick={() => setEditing("new")} className="btn btn-primary ml-auto !px-3 !py-1.5 !text-[11px]">
          <Plus className="h-3.5 w-3.5" /> New Record
        </button>
      </div>

      {/* table */}
      <div className="overflow-x-auto border border-border">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-panel-2/60">
              {["ID", "Title", "City", "Category", "Severity", "Status", "Assignee", "Updated", ""].map((h) => (
                <th key={h} className="mono px-2.5 py-2 text-left text-[9px] uppercase tracking-wider text-muted-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="mono px-3 py-6 text-center text-[11px] text-muted-2">No records — create one.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border/50 hover:bg-panel-2/40">
                <td className="mono px-2.5 py-2 text-[10px] text-muted-2">{r.id}</td>
                <td className="px-2.5 py-2 text-[12px] text-text">{r.title}</td>
                <td className="mono px-2.5 py-2 text-[11px] text-text">{r.city || "—"}</td>
                <td className="mono px-2.5 py-2 text-[11px] text-muted">{r.category}</td>
                <td className="mono px-2.5 py-2 text-[10px] uppercase" style={{ color: SEV_COLOR[r.severity] }}>{r.severity}</td>
                <td className="px-2.5 py-2">
                  <span className="mono border px-1.5 py-0.5 text-[9px] uppercase" style={{ color: STATUS_COLOR[r.status], borderColor: STATUS_COLOR[r.status] + "80" }}>
                    {r.status}
                  </span>
                </td>
                <td className="mono px-2.5 py-2 text-[10px] text-muted">{r.assignee}</td>
                <td className="mono px-2.5 py-2 text-[10px] text-muted-2">{clockString(new Date(r.updatedAt))}</td>
                <td className="px-2.5 py-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditing(r)} title="Edit" className="flex h-6 w-6 items-center justify-center border border-border text-muted hover:border-red/50 hover:text-red-bright">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button onClick={() => { if (confirm(`Delete ${r.id}?`)) deleteRecord(r.id); }} title="Delete" className="flex h-6 w-6 items-center justify-center border border-border text-muted hover:border-red/50 hover:text-red-bright">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecordEditor({ record, onDone }: { record: CaseRecord | null; onDone: () => void }) {
  const addRecord = useRecords((s) => s.addRecord);
  const updateRecord = useRecords((s) => s.updateRecord);
  const [f, setF] = useState({
    title: record?.title ?? "",
    city: record?.city ?? "",
    category: record?.category ?? "Other",
    severity: (record?.severity ?? "medium") as CaseSeverity,
    status: (record?.status ?? "Open") as CaseStatus,
    assignee: record?.assignee ?? "Unassigned",
    wallet: record?.wallet ?? "",
    handle: record?.handle ?? "",
    notes: record?.notes ?? "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  function save() {
    if (record) updateRecord(record.id, f);
    else addRecord(f);
    onDone();
  }

  return (
    <div className="p-4">
      <button onClick={onDone} className="mono mb-3 flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted hover:text-text">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to records
      </button>
      <h3 className="font-heading text-lg font-bold text-white">{record ? `Edit ${record.id}` : "New Case Record"}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Title" full>
          <input value={f.title} onChange={(e) => set("title", e.target.value)} className="field" placeholder="Case title" />
        </Field>
        <Field label="City">
          <select value={f.city} onChange={(e) => set("city", e.target.value)} className="field mono">
            <option value="">—</option>
            {CITIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Category">
          <select value={f.category} onChange={(e) => set("category", e.target.value)} className="field mono">
            {CASE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Severity">
          <select value={f.severity} onChange={(e) => set("severity", e.target.value)} className="field mono">
            {["high", "medium", "low"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select value={f.status} onChange={(e) => set("status", e.target.value)} className="field mono">
            {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Assignee">
          <select value={f.assignee} onChange={(e) => set("assignee", e.target.value)} className="field mono">
            {CASE_OFFICERS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </Field>
        <Field label="Wallet">
          <input value={f.wallet} onChange={(e) => set("wallet", e.target.value)} className="field mono" placeholder="optional" />
        </Field>
        <Field label="Handle">
          <input value={f.handle} onChange={(e) => set("handle", e.target.value)} className="field mono" placeholder="@optional" />
        </Field>
        <Field label="Notes" full>
          <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className="field slim-scroll resize-none" placeholder="Investigation notes…" />
        </Field>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={save} className="btn btn-primary !py-2 !text-[12px]"><Save className="h-3.5 w-3.5" /> {record ? "Save changes" : "Create record"}</button>
        <button onClick={onDone} className="btn btn-ghost !py-2 !text-[12px]">Cancel</button>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div className="label mb-1.5">{label}</div>
      {children}
    </div>
  );
}

// ---------------- ANALYTICS ----------------
function AnalyticsTab() {
  const intercepts = useIntel((s) => s.intercepts);
  const cityHeat = useIntel((s) => s.cityHeat);
  const records = useRecords((s) => s.records);

  const sev = { high: 0, medium: 0, low: 0 } as Record<string, number>;
  const src: Record<string, number> = { Marketplace: 0, Forum: 0, Paste: 0, Bridge: 0 };
  intercepts.forEach((i) => { sev[i.severity]++; src[i.source] = (src[i.source] ?? 0) + 1; });
  const sevData = Object.entries(sev).map(([name, value]) => ({ name, value }));
  const srcData = Object.entries(src).map(([name, value]) => ({ name, value }));
  const topCities = Object.entries(cityHeat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  const statusData = CASE_STATUSES.map((st) => ({ name: st, value: records.filter((r) => r.status === st).length }));
  const activity = activityBuckets(intercepts, Date.now());

  return (
    <div className="grid gap-3 p-4 md:grid-cols-2">
      <Graph title="Intercept Severity">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={sevData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={2}>
              {sevData.map((d) => <Cell key={d.name} fill={SEV_COLOR[d.name as CaseSeverity]} />)}
            </Pie>
            <RTooltip contentStyle={tipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <Legend items={sevData.map((d) => ({ name: d.name, color: SEV_COLOR[d.name as CaseSeverity], value: d.value }))} />
      </Graph>

      <Graph title="Source Breakdown">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={srcData}>
            <XAxis dataKey="name" tick={{ fill: "#B4B4BE", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <RTooltip contentStyle={tipStyle} cursor={{ fill: "rgba(225,6,0,0.08)" }} />
            <Bar dataKey="value" fill="#E10600" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Graph>

      <Graph title="Top Mentioned Cities (threat-heat)">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={topCities} layout="vertical" margin={{ left: 10 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={80} tick={{ fill: "#B4B4BE", fontSize: 10, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
            <RTooltip contentStyle={tipStyle} cursor={{ fill: "rgba(225,6,0,0.08)" }} />
            <Bar dataKey="value" fill="#FF3B30" radius={[0, 2, 2, 0]} barSize={12} />
          </BarChart>
        </ResponsiveContainer>
      </Graph>

      <Graph title="Case Records by Status">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={statusData}>
            <XAxis dataKey="name" tick={{ fill: "#B4B4BE", fontSize: 9, fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <RTooltip contentStyle={tipStyle} cursor={{ fill: "rgba(225,6,0,0.08)" }} />
            <Bar dataKey="value" radius={[2, 2, 0, 0]}>
              {statusData.map((d) => <Cell key={d.name} fill={STATUS_COLOR[d.name as CaseStatus]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Graph>

      <Graph title="Activity — last 90s" wide>
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={activity} margin={{ top: 6, right: 6, bottom: 0, left: 6 }}>
            <defs>
              <linearGradient id="ract" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E10600" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#E10600" stopOpacity={0} />
              </linearGradient>
            </defs>
            <RTooltip contentStyle={tipStyle} />
            <Area type="monotone" dataKey="v" stroke="#FF3B30" strokeWidth={1.5} fill="url(#ract)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Graph>
    </div>
  );
}

const tipStyle = { background: "#1E1E25", border: "1px solid #3A3A44", borderRadius: 4, fontFamily: "var(--font-mono)", fontSize: 11, color: "#F4F4F5" };

function Graph({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`border border-border bg-panel-2/30 p-3 ${wide ? "md:col-span-2" : ""}`}>
      <div className="label mb-2">{title}</div>
      {children}
    </div>
  );
}

function Legend({ items }: { items: { name: string; color: string; value: number }[] }) {
  return (
    <div className="mt-1 flex flex-wrap justify-center gap-3">
      {items.map((i) => (
        <span key={i.name} className="mono flex items-center gap-1 text-[10px] text-muted">
          <span className="h-2 w-2" style={{ background: i.color }} /> {i.name} ({i.value})
        </span>
      ))}
    </div>
  );
}

// ---------------- REPORTS ----------------
function ReportsTab() {
  const records = useRecords((s) => s.records);
  const alertLog = useIntel((s) => s.alertLog);
  const total = useIntel((s) => s.totalIntercepts);
  const breaches = useIntel((s) => s.geofenceBreaches);

  const stats = [
    { label: "Total Records", value: records.length },
    { label: "Open", value: records.filter((r) => r.status === "Open").length },
    { label: "Escalated", value: records.filter((r) => r.status === "Escalated").length },
    { label: "Closed", value: records.filter((r) => r.status === "Closed").length },
    { label: "Intercepts", value: total },
    { label: "Breaches", value: breaches },
  ];

  function download(name: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    const rows = records.map((r) =>
      `<tr><td>${r.id}</td><td>${r.title}</td><td>${r.city}</td><td>${r.category}</td><td>${r.severity.toUpperCase()}</td><td>${r.status}</td><td>${r.assignee}</td></tr>`
    ).join("");
    const html = `<!doctype html><html><head><title>PRAHARI Case Report</title>
      <style>body{font-family:monospace;background:#fff;color:#111;padding:32px}
      h1{color:#E10600}table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{border:1px solid #ccc;padding:7px 10px;text-align:left;font-size:12px}
      th{background:#f3f3f3;text-transform:uppercase}</style></head>
      <body><h1>PRAHARI — CASE RECORDS REPORT</h1>
      <div>MP Cyber Cell · Jabalpur · Generated ${new Date().toLocaleString()} · ${records.length} records · SYNTHETIC DATA</div>
      <table><thead><tr><th>ID</th><th>Title</th><th>City</th><th>Category</th><th>Severity</th><th>Status</th><th>Assignee</th></tr></thead>
      <tbody>${rows || '<tr><td colspan=7>No records</td></tr>'}</tbody></table>
      <script>window.onload=()=>window.print()</script></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="border border-border bg-panel-2/40 px-3 py-3">
            <div className="mono text-[9px] uppercase tracking-wider text-muted-2">{s.label}</div>
            <div className="mono mt-1 text-2xl font-bold text-red-bright">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="label mt-6 mb-2">Export & Reports</div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => download(`prahari-records-${Date.now()}.json`, { generated: new Date().toISOString(), records })} className="btn btn-ghost !py-2 !text-[12px]">
          <Download className="h-3.5 w-3.5" /> Export Records (JSON)
        </button>
        <button onClick={() => download(`prahari-alerts-${Date.now()}.json`, { generated: new Date().toISOString(), alerts: alertLog })} className="btn btn-ghost !py-2 !text-[12px]">
          <Download className="h-3.5 w-3.5" /> Export Alerts (JSON)
        </button>
        <button onClick={printReport} className="btn btn-primary !py-2 !text-[12px]">
          <FileText className="h-3.5 w-3.5" /> Printable Case Report
        </button>
      </div>

      <div className="mono mt-6 border-l-2 border-red/60 bg-panel-2/40 p-3 text-[11px] leading-relaxed text-muted">
        Reports summarise all case records and geofence alerts for hand-off to a senior officer or
        CCTNS entry. All data is synthetic in this build.
      </div>
    </div>
  );
}
