"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity, Database, Gauge, Loader2, LockKeyhole, RotateCcw, ScrollText, ShieldCheck,
  Trash2, TriangleAlert, Undo2, Users,
} from "lucide-react";
import { admin, refreshStatus, type AdminRefusal, type AdminStatus } from "@/lib/adminClient";
import { SIGNAL_LABEL, signalVar, type SignalRoot } from "@/lib/signals";
import StepUpGate from "./StepUpGate";

/**
 * THE COMMAND PANEL (DEC-058, DEC-059, DEC-060).
 *
 * Management, CRUD, analytics and the audit chain. Everything it can do is
 * decided by the server; this renders the answer and offers the recovery path.
 *
 * Two rules run through the whole surface:
 *
 *   NOTHING IS HARD-DELETED. Delete is soft, the row stays in exports, and an
 *   undo is offered. The wording says "withdraw", not "delete", because calling
 *   it delete would misdescribe what happened.
 *
 *   NO ACTION IS OFFERED THAT THE ROLE CANNOT PERFORM. Buttons a role lacks the
 *   permission for are absent, not disabled-and-explained. That is a courtesy,
 *   not a control -- the server refuses regardless, and `authz.test.ts` is what
 *   proves it.
 */

const KINDS = ["personas", "posts", "entities", "actors", "cases", "sources", "users"] as const;
type Kind = (typeof KINDS)[number];

type Row = Record<string, unknown> & {
  id: string;
  updated_at: string;
  updated_by: string;
  deleted_at: string | null;
  deleted_by: string | null;
};

interface ListResponse {
  ok: boolean;
  total: number;
  count: number;
  items: Row[];
  includes_deleted: boolean;
}

type Tab = "records" | "analytics" | "activity" | "retention" | "uptime";

interface UptimeState {
  ok: boolean;
  uptime_s?: number;
  awake_since?: string;
  pings_24h?: number;
  budget_used_pct?: number;
  next_window?: string;
}

function Banner({ refusal, onStepUp }: { refusal: AdminRefusal; onStepUp: () => void }) {
  return (
    <div
      role="alert"
      className="mono flex flex-wrap items-center gap-2 border border-[var(--c-high)] bg-[color-mix(in_srgb,var(--c-high)_10%,transparent)] px-2.5 py-2 text-[10px] text-[var(--text)]"
    >
      <TriangleAlert className="h-3 w-3 shrink-0 text-[var(--c-high)]" />
      <span className="min-w-0 flex-1">{refusal.detail}</span>
      {(refusal.action === "step-up" || refusal.action === "fresh-step-up") && (
        <button
          onClick={onStepUp}
          className="shrink-0 border border-[var(--border-2)] px-2 py-1 text-[9px] uppercase tracking-[0.12em] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)]"
        >
          Enter a code
        </button>
      )}
      {refusal.action === "sign-in" && (
        <Link href="/login" className="shrink-0 underline decoration-dotted underline-offset-2">
          Sign in again
        </Link>
      )}
      {refusal.action === "reload" && (
        <button
          onClick={() => window.location.reload()}
          className="shrink-0 underline decoration-dotted underline-offset-2"
        >
          Reload
        </button>
      )}
    </div>
  );
}

export default function CommandPanel() {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [tab, setTab] = useState<Tab>("records");
  const [kind, setKind] = useState<Kind>("personas");
  const [rows, setRows] = useState<ListResponse | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [refusal, setRefusal] = useState<AdminRefusal | null>(null);
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState<{ open: boolean; fresh: boolean }>({ open: false, fresh: false });
  const [note, setNote] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [signals, setSignals] = useState<{ root: string; survived: number; discarded: number }[]>([]);
  const [activity, setActivity] = useState<Record<string, unknown>[]>([]);
  const [purge, setPurge] = useState<{ before: string; approver: string; reason: string; preview: unknown }>(
    { before: "2020-01-01", approver: "", reason: "", preview: null }
  );
  const [uptime, setUptime] = useState<UptimeState | null>(null);

  const can = useCallback(
    (permission: string) => Boolean(status?.permissions?.includes(permission)),
    [status]
  );

  useEffect(() => {
    void refreshStatus().then(setStatus);
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    setRefusal(null);
    const res = await admin.list<ListResponse>(kind, {
      limit: "50",
      include_deleted: String(showDeleted),
    });
    setBusy(false);
    if (res.ok) setRows(res.data);
    else setRefusal(res);
  }, [kind, showDeleted]);

  useEffect(() => {
    if (tab === "records") void load();
  }, [tab, load]);

  useEffect(() => {
    if (tab !== "analytics") return;
    void (async () => {
      const [o, s] = await Promise.all([
        admin.analytics<Record<string, unknown>>("overview"),
        admin.analytics<{ roots: { root: string; survived: number; discarded: number }[] }>("signals"),
      ]);
      if (o.ok) setAnalytics(o.data);
      else setRefusal(o);
      if (s.ok) setSignals(s.data.roots ?? []);
    })();
  }, [tab]);

  useEffect(() => {
    if (tab !== "uptime") return;
    void fetch("/api/engine/health/ping", { cache: "no-store" })
      .then((r) => r.json())
      .then(setUptime)
      .catch(() => setUptime({ ok: false }));
  }, [tab]);

  useEffect(() => {
    if (tab !== "activity") return;
    void admin.activity<{ records: Record<string, unknown>[] }>().then((r) => {
      if (r.ok) setActivity(r.data.records ?? []);
      else setRefusal(r);
    });
  }, [tab]);

  /** Run a mutation, and route a step-up refusal into the gate. */
  async function mutate<T>(fn: () => Promise<{ ok: true; data: T } | AdminRefusal>, label: string) {
    setBusy(true);
    setNote(null);
    const res = await fn();
    setBusy(false);
    if (res.ok) {
      setRefusal(null);
      setNote(`${label} — recorded in the audit chain.`);
      await load();
      void refreshStatus().then(setStatus);
      return;
    }
    setRefusal(res);
    if (res.action === "step-up" || res.action === "fresh-step-up") {
      setGate({ open: true, fresh: res.action === "fresh-step-up" });
    }
  }

  const stepUp = status?.stepUp;

  return (
    <div className="space-y-3">
      {/* ---- header ------------------------------------------------------ */}
      <header className="glass flex flex-wrap items-center justify-between gap-3 p-3">
        <div>
          <h1 className="mono flex items-center gap-1.5 text-[12px] uppercase tracking-[0.18em] text-[var(--text)]">
            <LockKeyhole className="h-3.5 w-3.5" /> Command panel
          </h1>
          <p className="mono mt-1 text-[9px] text-[var(--muted-2)]">
            Role <span className="text-[var(--text)]">{status?.role ?? "unknown"}</span> ·{" "}
            {status?.permissions?.length ?? 0} permissions · every change is signed into the audit chain
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            data-testid="stepup-state"
            className="mono border border-[var(--border-2)] px-2 py-1 text-[9px] text-[var(--muted-2)]"
          >
            {stepUp?.fresh
              ? "Step-up fresh"
              : stepUp?.valid
                ? `Step-up valid (${Math.round(stepUp.ageSeconds ?? 0)}s old)`
                : "No step-up"}
          </span>
          <button
            onClick={() => setGate({ open: true, fresh: false })}
            className="mono border border-[var(--border-2)] px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)]"
          >
            <ShieldCheck className="mr-1 inline h-3 w-3" />
            {status?.enrolled ? "Step up" : "Enrol"}
          </button>
        </div>
      </header>

      {refusal && <Banner refusal={refusal} onStepUp={() => setGate({ open: true, fresh: refusal.action === "fresh-step-up" })} />}
      {note && (
        <p role="status" className="mono border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-2 text-[10px] text-[var(--muted)]">
          {note}
        </p>
      )}

      {/* ---- tabs -------------------------------------------------------- */}
      <nav className="glass flex flex-wrap gap-1 p-1.5" aria-label="Command panel sections">
        {([
          ["records", "Records", Database],
          ["analytics", "Analytics", Gauge],
          ["activity", "Audit chain", ScrollText],
          ["retention", "Retention", Trash2],
          ["uptime", "Uptime", Activity],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={`mono flex items-center gap-1.5 rounded-[var(--radius)] px-2.5 py-1.5 text-[9.5px] uppercase tracking-[0.12em] transition ${
              tab === id
                ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--c-high)]"
                : "text-[var(--muted-2)] hover:text-[var(--muted)]"
            }`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </nav>

      {/* ---- records ----------------------------------------------------- */}
      {tab === "records" && (
        <section className="glass p-3">
          <div className="mb-2.5 flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Entity kind" className="flex flex-wrap gap-1">
              {KINDS.map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  aria-pressed={kind === k}
                  className={`mono border px-2 py-1 text-[9px] uppercase tracking-[0.1em] transition ${
                    kind === k
                      ? "border-[var(--accent)] text-[var(--c-high)]"
                      : "border-[var(--border)] text-[var(--muted-2)] hover:text-[var(--muted)]"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
            <label className="mono ml-auto flex items-center gap-1.5 text-[9px] text-[var(--muted)]">
              <input
                type="checkbox"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
              />
              Show withdrawn records
            </label>
          </div>

          <p className="mono mb-2 text-[9px] leading-relaxed text-[var(--muted-2)]">
            {rows
              ? `${rows.count} of ${rows.total}. ${rows.includes_deleted ? "Withdrawn records are included." : "Withdrawn records are hidden — they still appear in exports."}`
              : busy
                ? "Loading…"
                : "No data."}
          </p>

          <div className="slim max-h-[52vh] overflow-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-[var(--surface)]">
                <tr className="mono text-[8.5px] uppercase tracking-[0.14em] text-[var(--muted-2)]">
                  <th scope="col" className="border-b border-[var(--border)] px-2 py-1.5 text-left">Id</th>
                  <th scope="col" className="border-b border-[var(--border)] px-2 py-1.5 text-left">Summary</th>
                  <th scope="col" className="border-b border-[var(--border)] px-2 py-1.5 text-left">Updated</th>
                  <th scope="col" className="border-b border-[var(--border)] px-2 py-1.5 text-left">State</th>
                  <th scope="col" className="border-b border-[var(--border)] px-2 py-1.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody data-testid="command-rows">
                {(rows?.items ?? []).map((r) => {
                  const summary = Object.entries(r)
                    .filter(([k]) => !["id", "kind", "updated_at", "updated_by", "deleted_at", "deleted_by"].includes(k))
                    .slice(0, 3)
                    .map(([k, v]) => `${k}=${String(v)}`)
                    .join(" · ");
                  return (
                    <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="mono px-2 py-1.5 text-[9.5px] text-[var(--text)]">{r.id}</td>
                      <td className="mono max-w-[38ch] truncate px-2 py-1.5 text-[9.5px] text-[var(--muted)]">
                        {summary}
                      </td>
                      <td className="mono px-2 py-1.5 text-[9px] text-[var(--muted-2)]">
                        {r.updated_at.slice(0, 19).replace("T", " ")}
                        {r.updated_by ? ` · ${r.updated_by}` : ""}
                      </td>
                      <td className="mono px-2 py-1.5 text-[9px]">
                        {r.deleted_at ? (
                          <span className="text-[var(--c-high)]">withdrawn</span>
                        ) : (
                          <span className="text-[var(--muted-2)]">live</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {can("manage:cases") && !r.deleted_at && (
                          <button
                            onClick={() =>
                              void mutate(
                                () => admin.softDelete(kind, r.id, r.updated_at, "withdrawn from the command panel"),
                                `Withdrew ${r.id}`
                              )
                            }
                            className="mono border border-[var(--border-2)] px-1.5 py-0.5 text-[8.5px] uppercase tracking-[0.1em] text-[var(--muted-2)] transition hover:border-[var(--c-high)] hover:text-[var(--c-high)]"
                          >
                            <Trash2 className="mr-1 inline h-2.5 w-2.5" />
                            Withdraw
                          </button>
                        )}
                        {can("manage:cases") && r.deleted_at && (
                          <button
                            onClick={() => void mutate(() => admin.restore(kind, r.id), `Restored ${r.id}`)}
                            className="mono border border-[var(--border-2)] px-1.5 py-0.5 text-[8.5px] uppercase tracking-[0.1em] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)]"
                          >
                            <Undo2 className="mr-1 inline h-2.5 w-2.5" />
                            Restore
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {(rows?.items ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="mono px-2 py-6 text-center text-[10px] text-[var(--muted-2)]">
                      {busy ? "Loading…" : "Nothing to show."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="mono mt-2 text-[8.5px] leading-relaxed text-[var(--muted-2)]">
            Withdrawing is a soft delete: the record is hidden from reads, kept in exports, and can be
            restored. Nothing in this panel hard-deletes evidence.
          </p>
        </section>
      )}

      {/* ---- analytics --------------------------------------------------- */}
      {tab === "analytics" && (
        <section className="glass p-3">
          <h2 className="mono mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            <Gauge className="h-3 w-3" /> Attribution
          </h2>
          {analytics ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {[
                ["Actors", String(analytics.actors ?? "—"), "Rows in the actor index."],
                ["Measured", String(analytics.measured ?? "—"), "Actors with a computed confidence."],
                ["Unmeasured", String(analytics.unmeasured ?? "—"), "No confidence computed — not a zero."],
                [
                  "Override rate",
                  `${(((analytics.override_rate as number) ?? 0) * 100).toFixed(1)}%`,
                  "Share of actors whose confidence an analyst overrode.",
                ],
              ].map(([label, value, hint]) => (
                <div key={label} className="border border-[var(--border)] bg-[var(--surface-2)] p-2.5">
                  <p className="mono text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">{label}</p>
                  <p className="mono tnum mt-1 text-lg font-bold text-[var(--text)]">{value}</p>
                  <p className="mono mt-0.5 text-[8.5px] leading-snug text-[var(--muted-2)]">{hint}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mono text-[10px] text-[var(--muted-2)]">Loading analytics…</p>
          )}

          <h2 className="mono mb-2 mt-4 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            <Activity className="h-3 w-3" /> Signal contribution
          </h2>
          <p className="mono mb-2 text-[9px] leading-relaxed text-[var(--muted-2)]">
            How often each root survives collapse versus is discarded. Genuinely diagnostic, and the
            one number nobody currently sees. Counted over every scored pair.
          </p>
          {signals.length > 0 ? (
            <ul className="space-y-1.5" data-testid="signal-contribution">
              {signals.map((s) => {
                const total = Math.max(1, s.survived + s.discarded);
                return (
                  <li key={s.root}>
                    <div className="mono flex items-center justify-between text-[9.5px]">
                      <span className="flex items-center gap-1.5 text-[var(--text)]">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 rounded-full"
                          style={{ background: `var(${signalVar(s.root as SignalRoot)})` }}
                        />
                        {SIGNAL_LABEL[s.root as SignalRoot] ?? s.root}
                      </span>
                      <span className="tnum text-[var(--muted-2)]">
                        {s.survived} survived · {s.discarded} discarded
                      </span>
                    </div>
                    <span className="bar mt-1 block">
                      <span
                        style={{
                          width: `${(s.survived / total) * 100}%`,
                          background: `var(${signalVar(s.root as SignalRoot)})`,
                        }}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mono text-[10px] text-[var(--muted-2)]">
              No signal-contribution data was returned.
            </p>
          )}
        </section>
      )}

      {/* ---- audit chain -------------------------------------------------- */}
      {tab === "activity" && (
        <section className="glass p-3">
          <h2 className="mono mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            <ScrollText className="h-3 w-3" /> Audit chain
          </h2>
          <p className="mono mb-2 text-[9px] leading-relaxed text-[var(--muted-2)]">
            Read from the chain itself, not from a parallel log that could disagree with it. Every
            entry is hash-linked to the one before and signed.
          </p>
          <div className="slim max-h-[52vh] overflow-auto">
            <ul className="space-y-1" data-testid="audit-records">
              {activity.map((r) => (
                <li
                  key={String(r.hash)}
                  className="mono border border-[var(--border)] bg-[var(--surface-2)] p-2 text-[9.5px]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[var(--text)]">
                      [{String(r.seq)}] {String(r.action)}
                    </span>
                    <span className="text-[var(--muted-2)]">
                      {String(r.actor)} · {String(r.ts).slice(0, 19).replace("T", " ")}
                      {r.signed ? " · signed" : " · UNSIGNED"}
                    </span>
                  </div>
                  <p className="mt-0.5 break-all text-[8.5px] text-[var(--muted-2)]">
                    prev {String(r.prev_hash).slice(0, 18)}… hash {String(r.hash).slice(0, 18)}…
                  </p>
                  {r.payload != null && (
                    <p className="mt-0.5 break-all text-[8.5px] text-[var(--muted)]">
                      {JSON.stringify(r.payload).slice(0, 220)}
                    </p>
                  )}
                </li>
              ))}
              {activity.length === 0 && (
                <li className="mono px-2 py-6 text-center text-[10px] text-[var(--muted-2)]">
                  No admin actions recorded yet.
                </li>
              )}
            </ul>
          </div>
        </section>
      )}

      {/* ---- retention ----------------------------------------------------- */}
      {tab === "retention" && (
        <section className="glass p-3">
          <h2 className="mono mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            <Trash2 className="h-3 w-3" /> Retention
          </h2>
          {!can("manage:retention") ? (
            <p className="mono text-[10px] text-[var(--muted-2)]">
              Your role does not hold <span className="text-[var(--text)]">manage:retention</span>.
              Retention is an administrator function.
            </p>
          ) : (
            <>
              <p className="mono mb-2 text-[9px] leading-relaxed text-[var(--muted-2)]">
                A purge is always dry-run first, needs a written reason and a SECOND approver who is
                not you, and even then soft-deletes rather than hard-deletes. A purge that cannot be
                dry-run is not shipped.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="mono text-[8.5px] uppercase tracking-[0.14em] text-[var(--muted-2)]">
                  Updated before
                  <input
                    type="date"
                    value={purge.before}
                    onChange={(e) => setPurge((p) => ({ ...p, before: e.target.value }))}
                    className="mono mt-1 block border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[10px] text-[var(--text)]"
                  />
                </label>
                <label className="mono text-[8.5px] uppercase tracking-[0.14em] text-[var(--muted-2)]">
                  Second approver
                  <input
                    value={purge.approver}
                    onChange={(e) => setPurge((p) => ({ ...p, approver: e.target.value }))}
                    placeholder="colleague@prahari.local"
                    className="mono mt-1 block border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[10px] text-[var(--text)]"
                  />
                </label>
                <label className="mono flex-1 text-[8.5px] uppercase tracking-[0.14em] text-[var(--muted-2)]">
                  Reason
                  <input
                    value={purge.reason}
                    onChange={(e) => setPurge((p) => ({ ...p, reason: e.target.value }))}
                    placeholder="retention policy 90d"
                    className="mono mt-1 block w-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[10px] text-[var(--text)]"
                  />
                </label>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() =>
                    void admin
                      .purge<Record<string, unknown>>(kind, purge.before, true)
                      .then((r) =>
                        r.ok ? setPurge((p) => ({ ...p, preview: r.data })) : setRefusal(r)
                      )
                  }
                  className="mono border border-[var(--border-2)] px-2 py-1.5 text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] transition hover:border-[var(--accent-dim)] hover:text-[var(--c-high)]"
                >
                  <RotateCcw className="mr-1 inline h-3 w-3" /> Dry run
                </button>
                <button
                  onClick={() =>
                    void mutate(
                      () =>
                        admin.purge(kind, purge.before, false, purge.reason, purge.approver),
                      "Purge applied"
                    )
                  }
                  disabled={!purge.reason || !purge.approver}
                  className="mono border border-[var(--c-high)] px-2 py-1.5 text-[9px] uppercase tracking-[0.12em] text-[var(--c-high)] transition disabled:opacity-40"
                >
                  Apply purge
                </button>
              </div>
              {purge.preview != null && (
                <pre className="slim mono mt-2 max-h-[30vh] overflow-auto border border-[var(--border)] bg-[var(--surface-2)] p-2 text-[9px] text-[var(--muted)]">
                  {JSON.stringify(purge.preview, null, 2)}
                </pre>
              )}
            </>
          )}
        </section>
      )}

      {/* ---- uptime -------------------------------------------------------- */}
      {tab === "uptime" && (
        <section className="glass p-3">
          <h2 className="mono mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            <Activity className="h-3 w-3" /> Keep-alive
          </h2>
          <p className="mono mb-2.5 text-[9px] leading-relaxed text-[var(--muted-2)]">
            Three free Render services share a 750-hour monthly pool, so the schedule is a budgeted
            seven-hour warm window rather than a ping loop. Every figure below is measured; none is
            hardcoded. The full arithmetic is in docs/UPTIME.md.
          </p>
          {uptime?.ok ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4" data-testid="uptime-card">
              {[
                ["Awake for", `${Math.round((uptime.uptime_s ?? 0) / 60)} min`,
                 "Since this instance last started."],
                ["Pings in 24 h", String(uptime.pings_24h ?? 0),
                 "Keep-alive requests the engine has seen."],
                ["Budget used", `${uptime.budget_used_pct ?? 0}%`,
                 "Estimated, of this service's 250-hour share. Render is the authority."],
                ["Next window", (uptime.next_window ?? "").slice(11, 16) || "—",
                 "When pinging next resumes, UTC."],
              ].map(([label, value, hint]) => (
                <div key={label} className="border border-[var(--border)] bg-[var(--surface-2)] p-2.5">
                  <p className="mono text-[8.5px] uppercase tracking-[0.16em] text-[var(--muted-2)]">
                    {label}
                  </p>
                  <p className="mono tnum mt-1 text-lg font-bold text-[var(--text)]">{value}</p>
                  <p className="mono mt-0.5 text-[8.5px] leading-snug text-[var(--muted-2)]">{hint}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mono text-[10px] text-[var(--muted-2)]">
              {uptime === null
                ? "Loading…"
                : "The engine did not answer. It may be cold-starting — allow 30–60 s."}
            </p>
          )}
          <p className="mono mt-2 text-[8.5px] leading-relaxed text-[var(--muted-2)]">
            Outside the window all three services sleep and consume nothing, and the first request
            wakes them in about a minute. Run <span className="text-[var(--text)]">npm run warmup</span>
            {" "}before a demo rather than relying on the schedule.
          </p>
        </section>
      )}

      {/* ---- sessions ------------------------------------------------------ */}
      <section className="glass p-3">
        <h2 className="mono mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
          <Users className="h-3 w-3" /> Active sessions
        </h2>
        <ul className="space-y-1" data-testid="session-list">
          {(status?.sessions ?? []).map((s) => (
            <li
              key={s.id}
              className="mono flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] py-1 text-[9.5px] last:border-0"
            >
              <span className="text-[var(--text)]">
                {s.current ? "This session" : "Other session"}
                {s.revoked ? " · revoked" : ""}
              </span>
              <span className="text-[var(--muted-2)]">
                started {s.createdAt.slice(0, 19).replace("T", " ")} · last seen{" "}
                {s.lastSeenAt.slice(0, 19).replace("T", " ")}
              </span>
            </li>
          ))}
          {(status?.sessions ?? []).length === 0 && (
            <li className="mono text-[10px] text-[var(--muted-2)]">No sessions recorded.</li>
          )}
        </ul>
      </section>

      {busy && (
        <p className="mono flex items-center gap-1.5 text-[9px] text-[var(--muted-2)]">
          <Loader2 className="h-3 w-3 animate-spin" /> Working…
        </p>
      )}

      <StepUpGate
        open={gate.open}
        needFresh={gate.fresh}
        onClose={() => setGate({ open: false, fresh: false })}
        onGranted={() => {
          setGate({ open: false, fresh: false });
          setRefusal(null);
          setNote("Step-up granted. Retry the action.");
          void refreshStatus().then(setStatus);
        }}
      />
    </div>
  );
}
